/**
 * This module handles account deletion.
 */

import db from '../database.js';
import { logEvents } from "../../middleware/logEvents.js";
import { getTranslationForReq } from "../../utility/translate.js";
import { testPasswordForRequest } from "./authController.js";
import { deleteUser, getMemberDataByCriteria } from "./memberController.js";
import { doStuffOnLogout } from './logoutController.js';

// Automatic deletion of accounts...

/** The maximum time an account is allowed to remain unverified before the server will delete it from DataBase. */
const maxExistenceTimeForUnverifiedAccountMillis = 1000 * 60 * 60 * 24 * 3; // 3 days
// const maxExistenceTimeForUnverifiedAccountMillis = 1000 * 40; // 30 seconds
/** The interval for how frequent to check for unverified account that exists more than `maxExistenceTimeForUnverifiedAccount` */
const intervalForRemovalOfOldUnverifiedAccountsMillis = 1000 * 60 * 60 * 24 * 1; // 1 days
// const intervalForRemovalOfOldUnverifiedAccountsMillis = 1000 * 30; // 30 seconds

const millisecondsInADay = 1000 * 60 * 60 * 24;



/**
 * Route that removes a user account if they request to delete it.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
async function removeAccount(req, res) {
	const claimedUsername = req.params.member;

	// The delete account request doesn't come with the username
	// already in the body, so we set that here.
	req.body.username = claimedUsername;
	if (!(await testPasswordForRequest(req, res))) { // It will have already sent a response
		return logEvents(`Incorrect password for user "${claimedUsername}" attempting to remove account!`, "loginAttempts.txt", { print: true });
	}

	// DELETE ACCOUNT..

	const { user_id, username, joined, login_count } = getMemberDataByCriteria(['user_id', 'username', 'joined', 'login_count'], 'username', claimedUsername);
	if (user_id === undefined) {
		return logEvents(`Unable to find member of claimed username "${claimedUsername}" after a correct password to delete their account!`, 'errLog.txt', { print: true });
		// if (user_id === undefined) return logEvents(`User "${usernameCaseInsensitive}" not found after a successful login! This should never happen.`, 'errLog.txt', { print: true });
	}

	// Close their sockets, delete their invites, delete their session cookies
	doStuffOnLogout(res, user_id, username);

	const reason_deleted = "user request";
	if (deleteUser(user_id, username, joined, login_count, reason_deleted)) {
		logEvents(`User ${claimedUsername} deleted their account.`, "deletedAccounts.txt", { print: true });
		return res.send('OK'); // 200 is default code
	} else {
		logEvents(`Can't delete ${claimedUsername}'s account after a correct password entered, they do not exist.`, 'errLog.txt', { print: true });
		return res.status(404).json({ 'message' : getTranslationForReq("server.javascript.ws-deleting_account_not_found", req) });
	}
}

// Automatic deletion of old, unverified accounts...

/**
 * Removes unverified members who have not verified their account for more than 3 days.
 */
function removeOldUnverifiedMembers() {
	console.log("Checking for old unverified accounts...");
	const now = Date.now();

	// Query to get all unverified accounts (where verification is not null)
	const notNullVerificationMembersQuery = `SELECT user_id, username, joined, login_count, verification FROM members WHERE verification IS NOT NULL`;
	const notNullVerificationMembers = db.all(notNullVerificationMembersQuery);

	const reason_deleted = "unverified";

	// Iterate through the unverified members
	for (const memberRow of notNullVerificationMembers) {
		// eslint-disable-next-line prefer-const
		let { user_id, username, joined, login_count, verification } = memberRow;
		verification = JSON.parse(verification);
		if (verification.verified) continue; // This guy is verified, just not notified.

		const timeSinceJoined = now - joined; // Milliseconds

		// If the account has been unverified for longer than the threshold, delete it
		if (timeSinceJoined > maxExistenceTimeForUnverifiedAccountMillis) {
			deleteUser(user_id, username, joined, login_count, reason_deleted);
			// Close their sockets, delete their invites, delete their session cookies
			doStuffOnLogout(undefined, user_id, username);
			logEvents(`Removed unverified account "${username}" of id "${user_id}" for being unverified more than ${maxExistenceTimeForUnverifiedAccountMillis / millisecondsInADay} days.`, 'deletedAccounts.txt', { print: true });
		}
	}
	console.log("Done!");
}

setInterval(removeOldUnverifiedMembers, intervalForRemovalOfOldUnverifiedAccountsMillis); // Repeatedly call once a day


export {
	removeAccount,
	removeOldUnverifiedMembers,
};
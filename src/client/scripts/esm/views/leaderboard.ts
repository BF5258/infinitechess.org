
/*
 * This script:
 *
 * * Fetches the data of the leaderboard page we're viewing
 * so we can display that info.
 */

import { Leaderboards, VariantLeaderboards } from "../chess/variants/validleaderboard.js";
import usernamecontainer from "../util/usernamecontainer.js";
import validatorama from "../util/validatorama.js";

import type { UsernameContainer, UsernameContainerDisplayOptions } from '../util/usernamecontainer.js';

// --- DOM Element Selection ---
const element_LeaderboardContainer = document.getElementById('leaderboard-table')!;
const element_supportedVariants = document.getElementById('supported-variants')!;
const element_ShowMoreButton: HTMLButtonElement = document.getElementById('show_more_button')! as HTMLButtonElement;
const element_UserRankingText = document.getElementById('user_ranking_text')!;
const element_UserRanking = document.getElementById('user_ranking')!;


// --- Variables ---

/** Number of players to be shown on leaderboard page load */
const LEADERBOARD_LENGTH_ON_LOAD = 50;
/** Number of players to be added on show more button press */
const LEADERBOARD_SHOW_MORE_BUTTON_INCREMENT = 50;
/** Leaderboard to be displayed */
const leaderboard_id = Leaderboards.INFINITY;

/** Body of leaderboard table, as created in createEmptyLeaderboardTable() */
let element_LeaderboardTableBody: HTMLTableSectionElement;
/** Running start rank: highest leaderboard position to be requested first */
let running_start_rank = 1;
/** Whether the page has already been initialized once */
let initialized = false;


// --- Initialization ---


(async function loadLeaderboardData(): Promise<void> {

	setSupportedVariantsDisplay();
	createEmptyLeaderboardTable();
	await populateTable(running_start_rank, LEADERBOARD_LENGTH_ON_LOAD);
	initialized = true;

	element_ShowMoreButton.addEventListener('click', showMorePlayers);
})();



// --- Functions ---


/**
 * Set the text below the leaderboard table, explaining which variants belong to it
 */
function setSupportedVariantsDisplay() {;
	const valid_variants = Object.keys(VariantLeaderboards);
	const variantslist: string[] = [];
	valid_variants.forEach((variant: string | null) => {
		if (variant === null || VariantLeaderboards[variant] !== leaderboard_id) return;
		variantslist.push( variant in translations ? translations[variant] : variant );
	});
	element_supportedVariants.textContent += `${translations["supported_variants"]} ${variantslist.join(", ")}.`;
};

/**
 * Create an empty leaderboard table upon page initialization
 */
function createEmptyLeaderboardTable() {
	// Create table
	const table = document.createElement("table");
	// Create header of table
	const thead = document.createElement("thead");
	thead.innerHTML = `
		<tr>
		<th>Rank</th>
		<th>Player</th>
		<th>Rating</th>
		</tr>
	`;
	table.appendChild(thead);

	// Create body of table
	element_LeaderboardTableBody = document.createElement("tbody");
	table.appendChild(element_LeaderboardTableBody);
	element_LeaderboardContainer.appendChild(table);
}

/**
 * Populate the leaderboard table for the chosen leaderboard, with the top n players.
 * If initialized === false, then this function also populates the "global ranking" element at the top
 * @param start_rank - highest rank of leaderboard player to add to table
 * @param n_players - number of players to add to table
 */
async function populateTable(start_rank: number, n_players: number) {

	// OKAY NOW we may to wait for validatorama to renew our session if needed,
	// as the server reads our session info to know who to return a global ranking for.
	await validatorama.waitUntilInitialRequestBack();
	const loggedInAs = validatorama.getOurUsername();

	const config: RequestInit = {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			"is-fetch-request": "true" // Custom header
		},
	};

	try {
		// Make server request
		// We need to fetch n_players + 1 and only display n_players in order to know whether the "Show more" button needs to be hidden
		// If initialized === false and the player is logged in, we also set find_requester_rank to 1, if possible, in order to request his rank from the server on the first page load
		const find_requester_rank = (!initialized && loggedInAs !== undefined ? 1 : 0);
		const response = await fetch(`/leaderboard/top/${leaderboard_id}/${start_rank}/${n_players + 1}/${find_requester_rank}`, config);

		if (response.status === 404 || response.status === 500 || !response.ok) {
			console.error("Failed to fetch leaderboard data:", response.status, response.statusText);
			return;
		}

		const results = await response.json();
		console.log(results);

		// Now populate the "your global rank" text at the top if possible
		if (!initialized && results.requesterData?.rank_string !== undefined) {
			element_UserRankingText.classList.remove("hidden");
			element_UserRanking.textContent = results.requesterData.rank_string;
		}
		
		// Iterate through all results.leaderboardData and add a row to the table body for each of them
		let rank = start_rank;
		results.leaderboardData.forEach((player: { username: string; elo: string }) => {
			if (rank >= start_rank + n_players) return;
			const row = document.createElement("tr");

			// Create and append <td> for rank
			const rankCell = document.createElement("td");
			rankCell.textContent = `${rank}`;
			row.appendChild(rankCell);

			// Create and append <td> for username
			const usernameCell = document.createElement("td");
			const usernamecontainer_object: UsernameContainer = { username: player.username };
			const usernamecontainer_options: UsernameContainerDisplayOptions = { makehyperlink: true, hyperlinktarget: "_self" };
			const usernamecontainer_display = usernamecontainer.createUsernameContainerDisplay(usernamecontainer_object, usernamecontainer_options);
			usernamecontainer.embedUsernameContainerDisplayIntoParent(usernamecontainer_display, usernameCell);
			row.appendChild(usernameCell);

			// Create and append <td> for elo
			const eloCell = document.createElement("td");
			eloCell.textContent = player.elo;
			row.appendChild(eloCell);

			// Append the completed row to the table body
			element_LeaderboardTableBody.appendChild(row);

			// Color row of logged in user
			if (loggedInAs === player.username) row.classList.add("logged_in_user_entry");

			rank++;
		});

		// Update running_start_rank
		running_start_rank += n_players;

		// Hide "show more" button if not enough players were returned by server
		if (results.leaderboardData.length < n_players + 1) element_ShowMoreButton.classList.add("hidden");
		else element_ShowMoreButton.classList.remove("hidden");

	} catch (error) {
		console.error("Error loading leaderboard data:", error);
	}
}

/**
 * Increase n_players and redraw the leaderboard table
 */
async function showMorePlayers() {
	// disable the button so it can’t be clicked again while we’re fetching
	element_ShowMoreButton.disabled = true;
	try {
		await populateTable(running_start_rank, LEADERBOARD_SHOW_MORE_BUTTON_INCREMENT);
	} finally {
		// re-enable regardless of success or failure
		element_ShowMoreButton.disabled = false;
	}
}

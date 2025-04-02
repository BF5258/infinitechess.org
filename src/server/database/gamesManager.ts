/**
 * This script handles queries to the games table. 
 */

// @ts-ignore
import { logEvents } from '../middleware/logEvents.js'; // Adjust path if needed
// @ts-ignore
import { ensureJSONString } from '../utility/JSONUtils.js';
// @ts-ignore
import db from './database.js';
// @ts-ignore
import { allGamesColumns } from './databaseTables.js';

import type { RunResult } from 'better-sqlite3'; // Import necessary types


// Type Definitions -----------------------------------------------------------------------------------


/** Structure of a games record. This is all allowed columns of a game_id. */
interface GamesRecord {
    game_id?: number;
    date?: Date;
    players?: string;
    elo?: string;
    rating_diff?: string;
    time_control?: string;
    variant?: string;
    rated?: boolean;
    private?: boolean;
    result?: string;
    termination?: string;
    movecount?: number;
    icn?: string;
}

/** The result of add/update operations */
type ModifyQueryResult = { success: true; result: RunResult } | { success: false; reason?: string };


// Methods --------------------------------------------------------------------------------------------

/**
 * Adds an entry to the games table
 * @param {number} game_id - The id for the game
 * @param {object} [options] - Optional parameters for all the entries of the game
 * @returns {ModifyQueryResult} A result object indicating success or failure.
 */
function addGameToGamesTable(game_id: number, 
	options: {
        date?: Date,
        players?: string,
        elo?: string,
        rating_diff?: string,
        time_control?: string,
        variant?: string,
        rated?: boolean,
        private?: boolean,
        result?: string,
        termination?: string,
        movecount?: number,
        icn?: string
    } = {}): ModifyQueryResult {

	const query = `
	INSERT INTO games (
		game_id,
        date,
        players,
        elo,
        rating_diff,
        time_control,
        variant,
        rated,
        private,
        result,
        termination,
        movecount,
        icn
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`;

	try {
		// Execute the query with the provided values
		const result = db.run(query, 
            [
                game_id,
                options.date,
                options.players,
                options.elo,
                options.rating_diff,
                options.time_control,
                options.variant,
                options.rated,
                options.private,
                options.result,
                options.termination,
                options.movecount,
                options.icn
            ]
		);

		// Return success result
		return { success: true, result };

	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		// Log the error for debugging purposes
		logEvents(`Error adding game to games table "${game_id}": ${message}`, 'errLog.txt', { print: true });

		// Return an error message
		// Check for specific constraint errors if possible (e.g., FOREIGN KEY failure)
		let reason = 'Failed to add game to games table.';
		if (error instanceof Error && 'code' in error) {
			// Example check for better-sqlite3 specific error codes
			if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
				reason = 'Game ID already exists in the games table.';
			}
		}
		return { success: false, reason };
	}
}

/**
 * Fetches specified columns of a single game from the games table based on game_id
 * @param {string[]} columns - The columns to retrieve (e.g., ['game_id', 'date', 'players']).
 * @param {number} game_id - The game_id of the game
 * @returns {GamesRecord} - An object containing the requested columns, or undefined if no match is found.
 */
function getGameData(columns: string[], game_id: number): GamesRecord | undefined {

	// Guard clauses... Validating the arguments...

	if (!Array.isArray(columns)) {
		logEvents(`When getting game data, columns must be an array of strings! Received: ${ensureJSONString(columns)}`, 'errLog.txt', { print: true });
		return undefined;
	}
	if (!columns.every(column => typeof column === 'string' && allGamesColumns.includes(column))) {
		logEvents(`Invalid columns requested from games table: ${ensureJSONString(columns)}`, 'errLog.txt', { print: true });
		return undefined;
	}

	// Arguments are valid, move onto the SQL query...

	// Construct SQL query
	const query = `SELECT ${columns.join(', ')} FROM games WHERE game_id = ?`;

	try {
		// Execute the query and fetch result
		const row = db.get(query, [game_id]) as GamesRecord | undefined;

		// If no row is found, return undefined
		if (!row) {
			logEvents(`No matches found for game_id = ${game_id}`, 'errLog.txt', { print: true });
			return undefined;
		}

		// Return the fetched row (single object)
		return row;
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		// Log the error and return undefined
		logEvents(`Error executing query: ${message}`, 'errLog.txt', { print: true });
		return undefined;
	}
}

/**
 * Updates multiple column values in the games table for a given game.
 * @param {number} game_id - The game ID of the games.
 * @param {GamesRecord} columnsAndValues - An object containing column-value pairs to update.
 * @returns {ModifyQueryResult} - A result object indicating success or failure.
 */
function updateGameColumns(game_id: number, columnsAndValues: GamesRecord): ModifyQueryResult {
	// Ensure columnsAndValues is an object and not empty
	if (typeof columnsAndValues !== 'object' || Object.keys(columnsAndValues).length === 0) {
		const reason = `Invalid or empty columns and values provided for game ID "${game_id}" when updating games columns!`;
		logEvents(reason, 'errLog.txt', { print: true });
		return { success: false, reason };
	}

	for (const column in columnsAndValues) {
		// Validate all provided columns
		if (!allGamesColumns.includes(column)) {
			const reason = `Invalid column "${column}" provided for game ID "${game_id}" when updating games columns!`;
			logEvents(reason, 'errLog.txt', { print: true });
			return { success: false, reason };
		}
	}

	// Dynamically build the SET part of the query
	const setStatements = Object.keys(columnsAndValues).map(column => `${column} = ?`).join(', ');
	const values = Object.values(columnsAndValues);

	// Add the game_id as the last parameter for the WHERE clause
	values.push(game_id);

	// Update query to modify multiple columns
	const updateQuery = `UPDATE games SET ${setStatements} WHERE game_id = ?`;

	try {
		// Execute the update query
		const result = db.run(updateQuery, values);

		// Check if the update was successful
		if (result.changes > 0) return { success: true, result };
		else {
			const reason = `No changes made when updating columns ${JSON.stringify(columnsAndValues)} for game in games table with id "${game_id}"!`;
			logEvents(reason, 'errLog.txt', { print: true });
			return { success: false, reason };
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		// Log the error for debugging purposes
		const reason = `Error updating columns ${JSON.stringify(columnsAndValues)} for game ID "${game_id}": ${message}`;
		logEvents(reason, 'errLog.txt', { print: true });

		// Return an error message
		return { success: false, reason };
	}
}


// Exports --------------------------------------------------------------------------------------------


export {
	addGameToGamesTable,
	getGameData,
	updateGameColumns
};	

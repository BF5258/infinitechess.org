
// Import Start
import input from '../input.js';
import enginegame from '../misc/enginegame.js';
import onlinegame from '../misc/onlinegame/onlinegame.js';
import stats from '../gui/stats.js';
import selection from '../chess/selection.js';
import piecesmodel from './piecesmodel.js';
import board from './board.js';
import statustext from '../gui/statustext.js';
import colorutil from '../../chess/util/colorutil.js';
import frametracker from './frametracker.js';
import timeutil from '../../util/timeutil.js';
import themes from '../../components/header/themes.js';
import preferences from '../../components/header/preferences.js';
import gameslot from '../chess/gameslot.js';
// Import End

"use strict";

/**
 * This script contains adjustable options such as
 * *Board color
 * *Highlight color
 * etc
 */

let em = false; // editMode, allows moving pieces anywhere else on the board!



(function() {
	document.addEventListener('theme-change', (event) => { // Custom Event listener.
		console.log(`Theme change event detected: ${preferences.getTheme()}`);
		updateTheme();
	});
})();

function disableEM() {
	em = false;
}

function getEM() {
	return em;
}

// Toggles EDIT MODE! editMode
// Called when '1' is pressed!
function toggleEM() {

	// Make sure it's legal
	const legalInPrivate = onlinegame.areInOnlineGame() && onlinegame.getIsPrivate() && input.isKeyHeld('0');
	if (onlinegame.areInOnlineGame() && !legalInPrivate) return; // Don't toggle if in an online game
	if (enginegame.areInEngineGame()) return; // Don't toggle if in an engine game

	frametracker.onVisualChange(); // Visual change, render the screen this frame
	em = !em;
	statustext.showStatus(`${translations.rendering.toggled_edit} ` + (em ? translations.rendering.on : translations.rendering.off));
}

/**
 * Return the color of the specified light or dark tile of our current theme.
 * @param {boolean} isWhite - True if we're wanting the light square color, otherwise dark square
 * @returns 
 */
function getDefaultTiles(isWhite) {
	const themeName = preferences.getTheme();
	if (isWhite) return themes.getPropertyOfTheme(themeName, 'lightTiles');
	else return themes.getPropertyOfTheme(themeName, 'darkTiles');
}

function getLegalMoveHighlightColor({ isOpponentPiece = selection.isOpponentPieceSelected(), isPremove = selection.arePremoving() } = {}) {
	const themeName = preferences.getTheme();
	if (isOpponentPiece) return themes.getPropertyOfTheme(themeName, 'legalMovesHighlightColor_Opponent');
	else if (isPremove) return themes.getPropertyOfTheme(themeName, 'legalMovesHighlightColor_Premove');
	else return themes.getPropertyOfTheme(themeName, 'legalMovesHighlightColor_Friendly');
}

function getDefaultLastMoveHighlightColor() {
	const themeName = preferences.getTheme();
	return themes.getPropertyOfTheme(themeName, 'lastMoveHighlightColor');
}

function getDefaultCheckHighlightColor() {
	const themeName = preferences.getTheme();
	return themes.getPropertyOfTheme(themeName, 'checkHighlightColor'); 
}

function getDefaultOutlineColor() {
	const themeName = preferences.getTheme();
	return themes.getPropertyOfTheme(themeName, 'boxOutlineColor');
}

function updateTheme() {
	board.updateTheme();
	piecesmodel.regenModel(gameslot.getGamefile(), getPieceRegenColorArgs());
}

/**
 * Determines the theme based on the current date.
 * @returns {string} The theme for the current date ('halloween', 'christmas', or 'default').
 */
function getHollidayTheme() {
	if (timeutil.isCurrentDateWithinRange(10, 25, 10, 31)) return 'halloween'; // Halloween week (October 25 to 31)
	// if (timeutil.isCurrentDateWithinRange(11, 23, 11, 29)) return 'thanksgiving'; // Thanksgiving week (November 23 to 29)
	if (timeutil.isCurrentDateWithinRange(12, 19, 12, 25)) return 'christmas'; // Christmas week (December 19 to 25)
	return themes.defaultTheme; // Default theme if not in a holiday week
}

/**
 * Returns the color arrays for the pieces, according to our theme.
 * @returns {Object} An object containing the properties "white", "black", and "neutral".
 */
function getPieceRegenColorArgs() {
	const themeName = preferences.getTheme();
	const themeProperties = themes.themes[themeName];
	if (!themeProperties.useColoredPieces) return; // Not using colored pieces

	return {
		white: themes.getPropertyOfTheme(themeName, 'whitePiecesColor'), // [r,g,b,a]
		black: themes.getPropertyOfTheme(themeName, 'blackPiecesColor'),
		neutral: themes.getPropertyOfTheme(themeName, 'neutralPiecesColor'),
	};
}

// Returns { r, g, b, a } depending on our current theme!
function getColorOfType(type) {
	const colorArgs = getPieceRegenColorArgs(); // { white, black, neutral }
	if (!colorArgs) return { r: 1, g: 1, b: 1, a: 1 }; // No theme, return default white.

	const pieceColor = colorutil.getPieceColorFromType(type); // white/black/neutral
	const color = colorArgs[pieceColor]; // [r,g,b,a]

	return {
		r: color[0],
		g: color[1],
		b: color[2],
		a: color[3]
	};
}


/*
 * The commented stuff below was ONLY used for fast
 * modifying of theme colors using the keyboard keys!!!
 */

// const allProperties = Object.keys(themes.themes[themes.defaultTheme]);
// let currPropertyIndex = 0;
// let currProperty = allProperties[currPropertyIndex];
// function update() {

// 	const themeProperties = themes.themes[theme];
	
// 	if (input.isKeyDown('u')) {
// 		currPropertyIndex--;
// 		if (currPropertyIndex < 0) currPropertyIndex = allProperties.length - 1;
// 		currProperty = allProperties[currPropertyIndex];
// 		console.log(`Selected property: ${currProperty}`);
// 	}
// 	if (input.isKeyDown('i')) {
// 		currPropertyIndex++;
// 		if (currPropertyIndex > allProperties.length - 1) currPropertyIndex = 0;
// 		currProperty = allProperties[currPropertyIndex];
// 		console.log(`Selected property: ${currProperty}`);
// 	}

// 	const amount = 0.02;

// 	if (input.isKeyDown('j')) {
// 		const dig = 0;
// 		themeProperties[currProperty][dig] += amount;
// 		if (themeProperties[currProperty][dig] > 1) themeProperties[currProperty][dig] = 1;
// 		console.log(themeProperties[currProperty]);
// 	}
// 	if (input.isKeyDown('m')) {
// 		const dig = 0;
// 		themeProperties[currProperty][dig] -= amount;
// 		if (themeProperties[currProperty][dig] < 0) themeProperties[currProperty][dig] = 0;
// 		console.log(themeProperties[currProperty]);
// 	}

// 	if (input.isKeyDown('k')) {
// 		const dig = 1;
// 		themeProperties[currProperty][dig] += amount;
// 		if (themeProperties[currProperty][dig] > 1) themeProperties[currProperty][dig] = 1;
// 		console.log(themeProperties[currProperty]);
// 	}
// 	if (input.isKeyDown(',')) {
// 		const dig = 1;
// 		themeProperties[currProperty][dig] -= amount;
// 		if (themeProperties[currProperty][dig] < 0) themeProperties[currProperty][dig] = 0;
// 		console.log(themeProperties[currProperty]);
// 	}

// 	if (input.isKeyDown('l')) {
// 		const dig = 2;
// 		themeProperties[currProperty][dig] += amount;
// 		if (themeProperties[currProperty][dig] > 1) themeProperties[currProperty][dig] = 1;
// 		console.log(themeProperties[currProperty]);
// 	}
// 	if (input.isKeyDown('.')) {
// 		const dig = 2;
// 		themeProperties[currProperty][dig] -= amount;
// 		if (themeProperties[currProperty][dig] < 0) themeProperties[currProperty][dig] = 0;
// 		console.log(themeProperties[currProperty]);
// 	}

// 	if (input.isKeyDown(';')) {
// 		const dig = 3;
// 		themeProperties[currProperty][dig] += amount;
// 		if (themeProperties[currProperty][dig] > 1) themeProperties[currProperty][dig] = 1;
// 		console.log(themeProperties[currProperty]);
// 	}
// 	if (input.isKeyDown('/')) {
// 		const dig = 3;
// 		themeProperties[currProperty][dig] -= amount;
// 		if (themeProperties[currProperty][dig] < 0) themeProperties[currProperty][dig] = 0;
// 		console.log(themeProperties[currProperty]);
// 	}


// 	if (input.isKeyDown('\\')) {
// 		console.log(JSON.stringify(themes.themes[theme]));
// 	}

// 	board.updateTheme();
// 	piecesmodel.regenModel(gameslot.getGamefile(), getPieceRegenColorArgs());
// 	highlights.regenModel();
// }



export default {
	toggleEM,
	getDefaultTiles,
	getLegalMoveHighlightColor,
	getDefaultLastMoveHighlightColor,
	getDefaultCheckHighlightColor,
	getDefaultOutlineColor,
	getPieceRegenColorArgs,
	getColorOfType,
	getEM,
	disableEM,
};

// Import Start
import bufferdata from './bufferdata.js';
import sound from '../misc/sound.js';
import movement from './movement.js';
import options from './options.js';
import board from './board.js';
import math from '../../util/math.js';
import perspective from './perspective.js';
import { createModel } from './buffermodel.js';
import frametracker from './frametracker.js';
import spritesheet from './spritesheet.js';
import shapes from './shapes.js';
// Import End

/**
 * Type Definitions
 * @typedef {import('../../chess/util/moveutil.js').Move} Move
 * @typedef {import('./buffermodel.js').BufferModel} BufferModel
 */

"use strict";

/**
 * This script handles the smooth animation when moving a piece from one coord to another
 * Also plays our sounds!
 */

/**
 * The z offset of the transparent square meant to block out the default
 * rendering of the pieces while the animation is visible.
 * 
 * THIS MUST BE GREATER THAN THE Z AT WHICH PIECES ARE RENDERED.
 */
const transparentSquareZ = 0.01;

const timeToPlaySoundEarly = 100;

const maxDistB4Teleport = 80; // 80

const animations = []; // { duration, startTime, type, startCoords, endCoords, captured, distIsGreater }

/** Used for calculating the duration move animations. */
const moveAnimationDuration = {
	/** The base amount of duration, in millis. */
	baseMillis: 150,
	/** The multiplier amount of duration, in millis, multiplied by the capped move distance. */
	multiplierMillis: 6,
};

/**
 * Animates a piece after moving it.   
 * @param {string} type - The type of piece to animate
 * @param {number[]} startCoords - [x,y]
 * @param {number[]} endCoords - [x,y]
 * @param {string} [captured] The type of piece captured, if one was captured.
 * @param {boolean} [resetAnimations] If false, allows animation of multiple pieces at once. Useful for castling. Default: true
 */
function animatePiece(type, startCoords, endCoords, captured, resetAnimations = true) { // captured: { type, coords }
	if (resetAnimations) clearAnimations();

	// let dist = math.euclideanDistance(startCoords, endCoords); // Distance between start and end points of animation.
	const dist = math.chebyshevDistance(startCoords, endCoords); // Distance between start and end points of animation.
	const distIsGreater = dist > maxDistB4Teleport; // True if distance requires a teleport because it's so big

	const newAnimation = {
		startTime: performance.now(),
		soundPlayed: false,

		type,
		startCoords,
		endCoords,
		captured,

		dist,
		distIsGreater,

		duration: getDurationMillisOfMoveAnimation({ startCoords, endCoords })
	};

	// Set a timer when to play the sound
	const timeToPlaySound = newAnimation.duration - timeToPlaySoundEarly;
	newAnimation.soundTimeoutID = setTimeout(playAnimationsSound, timeToPlaySound, newAnimation);

	animations.push(newAnimation);
}

/**
 * Calculates the duration in milliseconds a particular move would take to animate.
 * @param {Move} move 
 */
function getDurationMillisOfMoveAnimation(move) {
	// let dist = math.euclideanDistance(startCoords, endCoords); // Distance between start and end points of animation.
	const dist = math.chebyshevDistance(move.startCoords, move.endCoords); // Distance between start and end points of animation.
	const cappedDist = Math.min(dist, maxDistB4Teleport);

	const additionMillis = moveAnimationDuration.multiplierMillis * cappedDist;

	return moveAnimationDuration.baseMillis + additionMillis;
}

// All animations cleared (skipping through moves quickly),
// make the sounds from the skipped ones quieter as well.
function clearAnimations() {
	for (const animation of animations) {
		clearTimeout(animation.soundTimeoutID); // Don't play it twice..
		if (!animation.soundPlayed) playAnimationsSound(animation, true); // .. play it NOW.
	}
	animations.length = 0; // Empties existing animations
}

// For each animation, plays the sound if it's time, and deletes the animation if over.
function update() {
	if (animations.length === 0) return;

	frametracker.onVisualChange();

	for (let i = animations.length - 1; i >= 0; i--) {
		const thisAnimation = animations[i];

		const passedTime = performance.now() - thisAnimation.startTime;

		if (passedTime > thisAnimation.duration) animations.splice(i, 1); // Delete this animation
	}
}

// Set dampen to true if we're skipping quickly through moves
// and we don't want this sound to be so loud
function playAnimationsSound(animation, dampen) {
	if (animation.captured) sound.playSound_capture(animation.dist, dampen);
	else sound.playSound_move(animation.dist, dampen);

	animation.soundPlayed = true;
}

function renderTransparentSquares() {
	if (animations.length === 0) return;

	const transparentModel = genTransparentModel();
	const position = [0,0,transparentSquareZ];
	transparentModel.render(position);
}

/**
 * Generates the model of a completely transparent square.
 * This is used to render-over, or block the normal rendering
 * of the piece in animation until the animation is over.
 * Otherwise there would be 2 copies of it, one in animation and one at its destination.
 * @returns {BufferModel} The buffer model
 */
function genTransparentModel() {
	const data = [];

	const color = [0, 0, 0, 0];
	for (const thisAnimation of animations) {
		data.push(...shapes.getTransformedDataQuad_Color_FromCoord(thisAnimation.endCoords, color));
	}

	return createModel(data, 2, "TRIANGLES", true);
}

function renderPieces() {
	if (animations.length === 0) return;

	const pieceModel = genPieceModel();
	// render.renderModel(pieceModel, undefined, undefined, "TRIANGLES", spritesheet.getSpritesheet());
	pieceModel.render();
}

/**
 * Generates the buffer model of the pieces currently being animated.
 * @returns {BufferModel} The buffer model
 */
function genPieceModel() {

	const data = [];

	for (const thisAnimation of animations) {

		const passedTime = performance.now() - thisAnimation.startTime;
		const equaX = passedTime / thisAnimation.duration;
		const equaY = -0.5 * Math.cos(equaX * Math.PI) + 0.5;

		let diffX = thisAnimation.endCoords[0] - thisAnimation.startCoords[0];
		let diffY = thisAnimation.endCoords[1] - thisAnimation.startCoords[1];

		// const dist = Math.hypot(diffX, diffY)
		const dist = thisAnimation.dist;

		let newX;
		let newY;

		if (!thisAnimation.distIsGreater) {
			const addX = diffX * equaY;
			const addY = diffY * equaY;

			newX = thisAnimation.startCoords[0] + addX;
			newY = thisAnimation.startCoords[1] + addY;

		} else {
			// 1st half or 2nd half?
			const firstHalf = equaX < 0.5;
			const neg = firstHalf ? 1 : -1;
			const actualEquaY = firstHalf ? equaY : 1 - equaY;

			const ratio = maxDistB4Teleport / dist;

			diffX *= ratio;
			diffY *= ratio;

			const target = firstHalf ? thisAnimation.startCoords : thisAnimation.endCoords;

			const addX = diffX * actualEquaY * neg;
			const addY = diffY * actualEquaY * neg;

			newX = target[0] + addX;
			newY = target[1] + addY;
		}

		const newCoords = [newX, newY];

		if (thisAnimation.captured) appendDataOfPiece(data, thisAnimation.captured.type, thisAnimation.captured.coords);

		appendDataOfPiece(data, thisAnimation.type, newCoords);
	}

	return createModel(data, 2, "TRIANGLES", true, spritesheet.getSpritesheet());
}

function appendDataOfPiece(data, type, coords) {

	const rotation = perspective.getIsViewingBlackPerspective() ? -1 : 1;
	const { texleft, texbottom, texright, textop } = bufferdata.getTexDataOfType(type, rotation);

	const boardPos = movement.getBoardPos();
	const boardScale = movement.getBoardScale();
	const startX = (coords[0] - boardPos[0] - board.gsquareCenter()) * boardScale;
	const startY = (coords[1] - boardPos[1] - board.gsquareCenter()) * boardScale;
	const endX = startX + 1 * boardScale;
	const endY = startY + 1 * boardScale;

	const { r, g, b, a } = options.getColorOfType(type);

	const bufferData = bufferdata.getDataQuad_ColorTexture(startX, startY, endX, endY, texleft, texbottom, texright, textop, r, g, b, a);

	data.push(...bufferData);
}

export default {
	animatePiece,
	update,
	renderTransparentSquares,
	renderPieces,
	getDurationMillisOfMoveAnimation
};
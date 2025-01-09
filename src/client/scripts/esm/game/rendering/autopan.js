
// Import start
import camera from './camera.js';
import arrows from './arrows.js';
import input from '../input.js';
// Import end

const maxAutopanDistance = 0;
const arrowCaptureSize = 50; //Should be greater or equal to maxAutopanDistance

let captureLegal = false;

function getVelocity() {
	if (captureLegal) return [0, 0];
	const [pointerX, pointerY] = input.getMousePos();
		
	let distanceFromEdge = Infinity;
	const left = pointerX + camera.getCanvasWidthVirtualPixels()/2;
	const right = -pointerX + camera.getCanvasWidthVirtualPixels()/2;
	const bottom = pointerY + camera.getCanvasHeightVirtualPixels()/2 - camera.getPIXEL_HEIGHT_OF_BOTTOM_NAV();
	const top = -pointerY + camera.getCanvasHeightVirtualPixels()/2 - camera.getPIXEL_HEIGHT_OF_TOP_NAV();
	
	if (distanceFromEdge > left) distanceFromEdge = left;
	if (distanceFromEdge > right) distanceFromEdge = right;
	if (distanceFromEdge > bottom) distanceFromEdge = bottom;
	if (distanceFromEdge > top) distanceFromEdge = top;
	
	let targetSpeed;
	if (distanceFromEdge > maxAutopanDistance) return [0, 0];
	else if (distanceFromEdge < 0) targetSpeed = 1;
	else targetSpeed = 1-distanceFromEdge/maxAutopanDistance;
	
	const hypot = Math.hypot(pointerX, pointerY);
	targetVelX = pointerX / hypot * targetSpeed;
	targetVelY = pointerY / hypot * targetSpeed;
	return [targetVelX, targetVelY]
}

function checkForArrowCapture(arrows) {
	const piece = selection.getPieceSelected();
	if (!piece) return false;
	let arrowsHovered = 0;
	
}

export default {
	getVelocity,
	checkForArrowCapture
}
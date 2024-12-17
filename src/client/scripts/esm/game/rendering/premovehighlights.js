
// Import start
import game from '../chess/game.js';
import options from '../rendering/options.js'
import shapes from '../rendering/shapes.js';
import buffermodel from '../rendering/buffermodel.js';
// Import end

"use strict"

/**
 * This script renders a highlight on squares that have been premove into or out of.
 */

const z = -0.005;

function render() {
	const gamefile = game.getGamefile();
	const premoves = gamefile.premoves;
	if (!premoves.length) return; //nothing to highlight
	const color = options.getDefaultPremoveHighlightColor();
	const data = [];
	data.push(...shapes.getTransformedDataQuad_Color3D_FromCoord(premoves[0].startCoords, z, color));
	for (const premove of premoves) { 
		data.push(...shapes.getTransformedDataQuad_Color3D_FromCoord(premove.endCoords, z, color));
	}
	const model = buffermodel.createModel_Colored(new Float32Array(data), 3, "TRIANGLES");
	model.render();
}

export default {
	render
}
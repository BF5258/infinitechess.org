/** 
 * This script records premoves made by the player and submits them to the server on their next turn.
 * The legality of the move is checked before submission.
 */

"use strict";

const premove = (function(){

    let premovesEnabled = true; //alows the user to make premoves.

    /** Enables or disables premoves.
     * @param {boolean} value - Are premoves enabled? 
     * - True: enable premoves
     * - False: disable premoves
     */
    function enablePremoves(value = true) {
        premovesEnabled = value;
        if(!value) clearPremoves(game.getGamefile());
    }

    /**
     * Has the user enabled premoves?
     * @returns {boolean}
     */
    function arePremovesEnabled() {
        return premovesEnabled;
    }

    /**
     * Returns true if the user has enabled premoves and they are allowed in the current game.
     * @returns {boolean}
     */
    function arePremovesAllowed() {
        return premovesEnabled; //&& game.getGamefile().gameRules.premovesAllowed;
    }

    /**
     * Submits the next premove to the server if it is legal;
     * otherwise, deletes the queue.
     * 
     * Only call function this when the legality of the premove can be verified(on our turn);
     * otherwise the move is deemed illegal.
     */
    function submitPremove(gamefile) {
        if(gamefile.premovesVisible) {
            return console.error("The premoves are still displayed on the board. Call `hidePremoves` first.");
        }

        if (!gamefile.premoves.length || !premovesEnabled)
            return; //The user has not made a premove.

        /** @type {Move} */ //We already checked that the array isn't empty. `premoves.shift()` should return a value.
        let premove = gamefile.premoves.shift();
        
        //check if the premove is legal
        
        if (!isMoveLegal(gamefile, premove))
        {
            //If this premove was innvalid all subsequent premoves are also invalid.
            clearPremoves(gamefile);
            return;
        }

        movepiece.makeMove(gamefile, premove, {animate: false});
        onlinegame.sendMove();
    }

    /**
     * Checks if `move` is legal. If so, it can be submitted to the server.
     * @param {gamefile} gamefile - the gamefile
     * @param {Move} move - the move to check
     * @returns {boolean}
     */
    function isMoveLegal(gamefile, move) {
        if(!onlinegame.isItOurTurn()) return false;
        let piece = gamefileutility.getPieceAtCoords(gamefile, move.startCoords);
        if(piece.type != move.type)
            return false; //The piece we had premoved no longer exists
        let legalMoves = legalmoves.calculate(gamefile, piece);
        return legalmoves.checkIfMoveLegal(legalMoves, move.startCoords, move.endCoords);
    }

    function  renderHighlights() {
        const gamefile = game.getGamefile();
        if(!gamefile.premovesVisible) return;
        const premoves = gamefile.premoves;
        const color = options.getDefaultPremoveHighlightColor();
        const data = [];
        for (const premove of premoves) { 
            data.push(...bufferdata.getDataQuad_Color3D_FromCoord(premove.endCoords, -0.005, color))
        }
        const model = buffermodel.createModel_Colored(new Float32Array(data), 3, "TRIANGLES");
        model.render();
    }

    /** Adds a premove to the queue.
     * @param {Piece} piece - the piece that was moved
     * @param {Move} move - the move the piece made
    */
    function makePremove(gamefile, move) {
        if (!premovesEnabled)
            return;
        if (main.devBuild) console.log("A premove was made.");
        
        gamefile.premoves.push(move);

        //There exists the possibility of the opponent capturing pieces obstructing a castle;
        //therefore, premove castling should be displayed regardless of obstructions.
        //TODO:
        // - If there are multiple rooks with special rights in the same direction,
        //   there is no way to premove with those that aren't the closest.
        //   Do any variants have this?

        if(gamefile.premovesVisible!==false) {
            gamefile.premovesVisible++;
            movepiece.makeMove(gamefile, move, {flipTurn: false, pushClock: false, doGameOverChecks: false, concludeGameIfOver: false, updateProperties: false });
        }
    }

    /** Sends all premoved pieces back to their original positions then clears the queue of premoves. */
    function clearPremoves(gamefile)
    {
        if (gamefile.premovesVisible) hidePremoves(gamefile);
        gamefile.premovesVisible = 0;
        gamefile.premoves = [];
    }

    /**
     * Remove all premoves from the list of moves. This must be called before adding moves from the server or analysing the position.
     * @param {gamefile} gamefile - the gamefile
     * @param {Object} options - An object containing options
     * - `updateData`: Whether to modify the mesh of all the pieces. Default is *true*.
     * - `clearRewindInfo`: Deletes `rewindInfo` and `captured` properties. Should be true if moves will be added to the gamefile. Default is *false*.
     */
    function hidePremoves(gamefile, {updateData = true, clearRewindInfo = false} = {}) {
        if(gamefile.premovesVisible===false) return console.error("Premoves are already hidden.");
        movepiece.forwardToFront(gamefile, { updateData, flipTurn: false, animateLastMove: false, updateProperties: false });
        while(gamefile.premovesVisible>0) {
            movepiece.rewindMove(gamefile, { updateData, animate: false, flipTurn: false });
            //Delete the rewind info as it may contain outdated information
            //It will be updated when `showPremoves` or `submitPremove` is called.
            if(clearRewindInfo) {
                const premove = gamefile.premoves[gamefile.premovesVisible-1];
                delete premove.rewindInfo;
                delete premove.captured;
            }
            gamefile.premovesVisible--;
        }
        gamefile.premovesVisible = false;
    }

    /**
     * 
     * @param {gamefile} gamefile 
     * @param {Object} options - An object containing options
     * - `updateData`: Whether to modify the mesh of all the pieces.
     */
    function showPremoves(gamefile, {updateData = true} = {}) {
        if(gamefile.premovesVisible|=0) return console.error("Premoves are already shown.");
        movepiece.forwardToFront(gamefile, { updateData, flipTurn: false, animateLastMove: false, updateProperties: false });
        while(gamefile.premovesVisible < gamefile.premoves.length) {
            const nextPremove = gamefile.premoves[gamefile.premovesVisible];
            
            //Check if the piece still exists
            const pieceTypeAtCoords = gamefileutility.getPieceTypeAtCoords(gamefile, nextPremove.startCoords);
            let pieceDestroyed = pieceTypeAtCoords !== nextPremove.type;
            if (nextPremove.castle) { //When castling the rook needs to be checked as well.
                const pieceToCastleWith = gamefileutility.getPieceTypeAtCoords(gamefile, nextPremove.castle.coords);
                const color = pieceToCastleWith && math.getPieceColorFromType(pieceToCastleWith);
                if (color!==onlinegame.getOurColor()) pieceDestroyed = true;
            }
            if (pieceDestroyed) {
                //The piece that was premoved has been captured. Cancel this premove and all after it.
                gamefile.premoves.length = gamefile.premovesVisible;
                break;
            }

            gamefile.premovesVisible++;
            movepiece.makeMove(gamefile, nextPremove, { updateData, flipTurn: false, pushClock: false, doGameOverChecks: false, concludeGameIfOver: false, updateProperties: false, animate: false });
        }
    }

    /**
     * Returns the number of premoves that have been applied at `index`.
     * @param {gamefile} gamefile - the gamefile
     * @param {number} [index] - The index to check. If undefined the current moveIndex is used.
     * @returns {number} The number of premoves visible at `index` or *false* if it is a past move.
    */
    function getPremoveCountAtIndex(gamefile, index) {
        const premoveNumber = index??gamefile.moveIndex + 1 - getPlyCountExcludingPremoves(gamefile);
        if (premoveNumber<0) return false;
        return premoveNumber;
    }

    /**
     * Returns the number of plys in the game excluding premoves
     * @param {gamefile} gamefile - the gamefile 
     * @returns {number}
    */
    function getPlyCountExcludingPremoves(gamefile) {
        return gamefile.moves.length - gamefile.premovesVisible;
    }

    /**
     * Returns true if move `index` is a premove.
     * @param {gamefile} gamefile 
     * @param {number} [index] - If index is undefined the current moveIndex is used.
     * @returns {boolean}
     */
    function isPremove(gamefile, index) {
        return index??gamefile.moveIndex >= getPlyCountExcludingPremoves(gamefile);
    }

    return Object.freeze({
        makePremove,
        hidePremoves,
        showPremoves,
        clearPremoves,
        renderHighlights,
        submitPremove,
        enablePremoves,
        arePremovesEnabled,
        arePremovesAllowed,
        getPlyCountExcludingPremoves,
        getPremoveCountAtIndex,
        isPremove
    });

})();
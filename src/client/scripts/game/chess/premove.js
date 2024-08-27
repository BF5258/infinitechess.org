/** 
 * This script records premoves made by the player and submits them to the server on their next turn.
 * The legality of the move is checked before submission.
 */

"use strict";

/** 
 * To do:
 * - Fix bugs
 * - allow castles to be premoved
 * Bugs:
 * - Check highlight is only rendered every second premove
 */


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

        movepiece.makeMove(gamefile, premove);
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
        // - Specialmoves doesn't check if there are pieces already at the destination.
        //   This causes organised lines to be confused as there are two pieces at the same coords.
        // - If there are multiple rooks with special rights in the same direction,
        //   there is no way to premove with those that aren't the closest.
        //   Do any variants have this?

        if(gamefile.premovesVisible) movepiece.makeMove(gamefile, move, {flipTurn: false, pushClock: false, doGameOverChecks: false, concludeGameIfOver: false, updateProperties: false });
    }

    /** Sends all premoved pieces back to their original positions then clears the queue of premoves. */
    function clearPremoves(gamefile)
    {
        if (gamefile.premovesVisible) hidePremoves(gamefile);
        gamefile.premovesVisible = true; //All premoves are on the board; there just happens to be none.
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
        if(!gamefile.premovesVisible) return console.error("Premoves are already hidden.");
        movepiece.forwardToFront(gamefile, { updateData, flipTurn: false, animateLastMove: false, updateProperties: false });
        for(let i=gamefile.premoves.length-1; i>=0; i--) {
            movepiece.rewindMove(gamefile, { updateData, animate: false, flipTurn: false });
            //Delete the rewind info as it may contain outdated information
            //It will be updated when `showPremoves` or `submitPremove` is called.
            if(clearRewindInfo) {
                const premove = gamefile.premoves[i];
                delete premove.rewindInfo;
                delete premove.captured;
            }
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
        if(gamefile.premovesVisible) return console.error("Premoves are already shown.");
        movepiece.forwardToFront(gamefile, { updateData, flipTurn: false, animateLastMove: false, updateProperties: false });
        for(let i=0; i<gamefile.premoves.length; i++) {
            const move = gamefile.premoves[i];
            const pieceTypeAtCoords = gamefileutility.getPieceTypeAtCoords(gamefile, move.startCoords);
            //TODO: When castling the rook needs to be checked as well.
            if (pieceTypeAtCoords != move.type) {
                //The piece that was premoved has been captured
                //cancel all premoves after this
                gamefile.premoves.length = i;
                break;
            }
            movepiece.makeMove(gamefile, move, { updateData, flipTurn: false, pushClock: false, doGameOverChecks: false, concludeGameIfOver: false, updateProperties: false });
        }
        gamefile.premovesVisible = true;
    }

    /**Returns *true* if we are currently makeing a premove.*/
    function isPremove() {
        return arePremovesAllowed() && onlinegame.areInOnlineGame() && !onlinegame.isItOurTurn();
    }

    /**
     * Returns the number of premoves that have been recorded.
     * @returns {number} Number of premoves that have been recorded.
     */
    function getPremoveCount() {
        return gamefile.premoves.length;
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
        getPremoveCount,
        //isPremove //Now redundent. selection.js keeps track of this
    });

})();
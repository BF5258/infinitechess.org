/** 
 * This script records premoves made by the player and submits them to the server on their next turn.
 * The legality of the move is checked before submission.
 */

"use strict";

const premove = (function(){

    let premovesEnabled = true; //alows the user to make premoves.

    //Have all premoves been applied to the board? True because their are currently none.
    let premovesVisible = true; 

    /** Enables or disables premoves.
     * @param {boolean} value - Are premoves allowed? 
     * - True: enable premoves
     * - False: disable premoves
     */
    function allowPremoves(value) {
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
     * The queue of premoves waiting to be verified and submitted.
     * @type {Move[]} 
     */
    let premoves = [];

    /** 
     * The number of times each square has been premoved through, stored by key: `{'5,7': 1, '5,5': 1}`
     * @type{Object<string, number>}
     */
    let highlightedSquares = {};

    /**
     * Submits the next premove to the server if it is legal;
     * otherwise, deletes the queue.
     * 
     * Only call function this when the legality of the premove can be verified(on our turn);
     * otherwise the move is deemed illegal.
     */
    function submitPremove() {
        if(premovesVisible) {
            return console.error("The premoves are still displayed on the board. Call `rewindPremoves` first.");
        }
        let gamefile = game.getGamefile();
        /**
         * The piece is unselected to prevent bugs where the player selects a moves that is no longer legal but was still displayed.
         * Ideally the following should be done instead:
         *      Unselect the piece if it no longer exists.
         *      Recalculate legal moves and new display options.
         *      Close the promotion GUI if promotion is no longer legal.
         */
        selection.unselectPiece();


        if (!premoves.length || !premovesEnabled)
            return; //The user has not made a premove.

        /** @type {Move} */ //We already checked that the array isn't empty. `premoves.shift()` should return a value.
        let premove = premoves.shift();
        
        //check if the premove is legal
        
        if (!isMoveLegal(gamefile, premove))
        {
            //If this premove was innvalid all subsequent premoves are also invalid.
            clearPremoves(gamefile);
            return;
        }

        movepiece.makeMove(game.getGamefile(), premove);
        onlinegame.sendMove();

        //If the last premove in the queue was just made,
        //clear all highlighted sqares.
        if(!premoves.length) {
            clearPremoves(gamefile);
            return;
        }

        //Remove the highlight as the move is no longer a premove.
        removeSquareHighlight(premove.startCoords); 
    }

    /**
     * Checks if `move` is legal. If so, it can be submitted to the server.
     * @param {Gamefile} gamefile - the gamefile
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
    
    /**
     * Highlights a square with the premove highlight color.
     * @param {number[]} coords - The coordinates to highlight: `[x,y]`
     * @param {number} max - Maximum number of times to highlight the square.
     */
    function addSquareHighlight(coords, max=Infinity) {
        const key = math.getKeyFromCoords(coords);
        highlightedSquares[key]??= 0;
        if(highlightedSquares[key]<max) highlightedSquares[key]++;
    }

    /** Remove premove highlight from a square.
     * @pram {number[]} coords - The coordinates of the square to un-highlight
     */
    function removeSquareHighlight(coords) {
        const key = math.getKeyFromCoords(coords);
        if(!(highlightedSquares[key]>0)) //`!(a>0)` is true if a is undefined. `a<=0` is not.
            return console.error("Cannot remove highlight as it was never added.");
        if(--highlightedSquares[key]<=0) delete highlightedSquares[key];
    }

    function clearAllSquareHighlights() {
        highlightedSquares = {};
    }

    function  renderHighlights() {
        const defaultColor = options.getDefaultPremoveHighlightColor();
        let color = defaultColor.slice();
        const data = [];
        for (const key in highlightedSquares) {
            const coords = math.getCoordsFromKey(key);
            const intensity = highlightedSquares[key];
            color[3] = 1 - Math.pow(1 - defaultColor[3], intensity); //Squares that have been moved through multiple times are more opaque. 
            data.push(...bufferdata.getDataQuad_Color3D_FromCoord(coords, -0.005, color))
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
        
        premoves.push(move);

        if(premovesVisible) movepiece.makeMove(gamefile, move, {flipTurn: false, pushClock: false, simulated: true, doGameOverChecks: false, concludeGameIfOver: false, updateProperties:false, isPremove: true})

        //Only highlight the start square on the first premove of each piece.
        //Otherwise, it was already highlighted when the previous premove was made.
        addSquareHighlight(move.startCoords, 1);
        addSquareHighlight(move.endCoords);
    }

    /** Sends all premoved pieces back to their original positions then clears the queue of premoves. */
    function clearPremoves(gamefile)
    {
        if (premovesVisible) rewindPremoves(gamefile);
        premovesVisible = true; //All premoves are visible on the board; there just happens to be none.
        premoves = [];
        clearAllSquareHighlights();
    }

    /**
     * 
     * @param {Gamefile} gamefile 
     * @param {Object} params 
     */
    function rewindPremoves(gamefile, {updateData = true} = {}) {
        if(!premovesVisible) {
            if(options.devBuild) console.log("Premoves are already hidden.");
            return;
        }
        premovesVisible = false;
        movepiece.forwardToFront(gamefile, { updateData });
        for(let i=0; i<premoves.length; i++)
            movepiece.rewindMove(gamefile, { updateData, animate: false, flipTurn: false })
    }

    function showPremoves(gamefile) {
        if(premovesVisible) {
            if(options.devBuild) console.log("Premoves are already shown.");
            return;
        }
        premovesVisible = true;
        for(let move of premoves) {
            movepiece.makeMove(gamefile, move, {flipTurn: false, doGameOverChecks: false, animate: false});
        }
    }

    /**Returns *true* if we are currently makeing a premove.*/
    function isPremove() {
        return premovesEnabled && onlinegame.areInOnlineGame() && !onlinegame.isItOurTurn();
    }

    /**
     * Returns the number of premoves that have been recorded.
     * @returns {number} Number of premoves that have been recorded.
     */
    function getPremoveCount() {
        return premovesEnabled? premoves.length : 0;
    }

    return Object.freeze({
        makePremove,
        rewindPremoves,
        showPremoves,
        clearPremoves,
        renderHighlights,
        submitPremove,
        allowPremoves,
        arePremovesEnabled,
        getPremoveCount,
        isPremove,
    });

})();
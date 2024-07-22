
/*
 * This script manages the organized lines of all pieces in the current game.
 * For example, pieces organized by type, coordinate, vertical, horizontal, diagonal, etc.
 * 
 * These dramatically increase speed of legal move calculation.
 */

"use strict";

// Module
const organizedlines = {
    /**
     * Organizes all the pieces of the specified game into many different lists,
     * organized in different ways. For example, organized by key `'1,2'`,
     * or by type `'queensW'`, or by row/column/diagonal.
     * 
     * These are helpful because they vastly improve performance. For instance,
     * if we know the coordinates of a piece, we don't have to iterate
     * through the entire list of pieces to find its type.
     * @param {gamefile} gamefile - The gamefile
     * @param {Object} [options] - An object that may contain the `appendUndefineds` option. If false, no undefined *null* placeholder pieces will be left for the mesh generation. Defaults to *true*. Set to false if you're planning on regenerating manually.
     */
    initOrganizedPieceLists: function (gamefile, { appendUndefineds = true} = {}) {
        if (!gamefile.ourPieces) return console.error("Cannot init the organized lines before ourPieces is defined.")
        
        // console.log("Begin organizing lists...")

        organizedlines.resetOrganizedLists(gamefile)
        // Organize each piece with a callback function.
        // We need .bind(this) to specify our parent object for the callback!
        // Otherwise it would not be able to access our gamefile's properties such as the organized lists to push to.
        gamefileutility.forEachPieceInGame(gamefile, organizedlines.organizePiece)
        
        // console.log("Finished organizing lists!")

        // Add extra undefined pieces into each type array!
        organizedlines.initUndefineds(gamefile)

        if (appendUndefineds) organizedlines.appendUndefineds(gamefile)
    },

    resetOrganizedLists: function(gamefile) {
        gamefile.piecesOrganizedByKey = {}
        gamefile.piecesOrganizedByLines = {}

        let lines = gamefile.startSnapshot.slidingPossible
        for (let i = 0; i<lines.length; i++) {
            gamefile.piecesOrganizedByLines[math.getKeyFromCoords(lines[i])] = {}
        }
    },

    // Inserts given piece into all the organized piece lists (key, row, column...)
    organizePiece: function (type, coords, gamefile) {
        if (!coords) return; // Piece is undefined, skip this one!

        const piece = { type, coords }

        // Organize by key
        // First, turn the coords into a key in the format 'x,y'
        let key = math.getKeyFromCoords(coords)
        // Is there already a piece there? (Desync)
        if (gamefile.piecesOrganizedByKey[key]) throw new Error(`While organizing a piece, there was already an existing piece there!! ${coords}`)
        gamefile.piecesOrganizedByKey[key] = type;
        
        // Organize by line
        let lines = gamefile.startSnapshot.slidingPossible
        for (let i = 0; i<lines.length; i++) {
            const line = lines[i]
            key = organizedlines.getKeyFromLine(line,coords)
            const strline = math.getKeyFromCoords(line)
            // Is line initialized
            if (!gamefile.piecesOrganizedByLines[strline][key]) gamefile.piecesOrganizedByLines[strline][key] = []
            gamefile.piecesOrganizedByLines[strline][key].push(piece)
        }
        
    },
    
    // Remove specified piece from all the organized piece lists (piecesOrganizedByKey, etc.)
    removeOrganizedPiece: function (gamefile, coords) {

        // Make the piece key undefined in piecesOrganizedByKey object  
        let key = math.getKeyFromCoords(coords)
        if (!gamefile.piecesOrganizedByKey[key]) throw new Error(`No organized piece at coords ${coords} to delete!`)
        // Delete is needed, I can't just set the key to undefined, because the object retains the key as 'undefined'
        delete gamefile.piecesOrganizedByKey[key] 

        let lines = gamefile.startSnapshot.slidingPossible
        for (let i = 0; i<lines.length; i++) {
            const line = lines[i]
            key = organizedlines.getKeyFromLine(line,coords)
            removePieceFromLine(gamefile.piecesOrganizedByLines[line],key)
        }

        // Takes a line from a property of an organized piece list, deletes the piece at specified coords
        function removePieceFromLine (organizedPieces, lineKey) {
            const line = organizedPieces[lineKey]

            for (let i = 0; i < line.length; i++) {
                const thisPieceCoords = line[i].coords
                if (thisPieceCoords[0] === coords[0] && thisPieceCoords[1] === coords[1]) {
                    line.splice(i, 1) // Delete
                    // If the line length is now 0, remove itself from the organizedPieces
                    if (line.length === 0) delete organizedPieces[lineKey];
                    break;
                }
            }
        }
    },

    initUndefineds: function(gamefile) {
        // Add extra undefined pieces into each type array!
        pieces.forEachPieceType(init)
        function init(listType) {
            const list = gamefile.ourPieces[listType];
            list.undefineds = [];
        }
    },


    /**
     * Adds more undefined placeholders, or *null* pieces, into the piece lists,
     * to allocate more space in the mesh of all the pieces.
     * Only called within `initOrganizedPieceLists()` because this assumes
     * each piece list has zero, so it adds the exact same amount to each list.
     * These placeholders are used up when pawns promote.
     * @param {gamefile} gamefile - The gamefile
     */
    appendUndefineds: function(gamefile) {
        pieces.forEachPieceType(append)

        function append(listType) {
            if (!organizedlines.isTypeATypeWereAppendingUndefineds(gamefile, listType)) return;

            const list = gamefile.ourPieces[listType];
            for (let i = 0; i < pieces.extraUndefineds; i++) organizedlines.insertUndefinedIntoList(list)
        }
    },

    areWeShortOnUndefineds: function(gamefile) {

        let weShort = false;
        pieces.forEachPieceType(areWeShort)

        function areWeShort(listType) {
            if (!organizedlines.isTypeATypeWereAppendingUndefineds(gamefile, listType)) return;

            const list = gamefile.ourPieces[listType];
            const undefinedCount = list.undefineds.length;
            if (undefinedCount === 0) weShort = true;
        }

        return weShort;
    },

    /**
     * Adds more undefined placeholders, or *null* pieces, into the piece lists,
     * to allocate more space in the mesh of all the pieces, then regenerates the mesh.
     * Makes sure each piece list has the bare minimum number of undefineds.
     * These placeholders are used up when pawns promote.
     * When they're gone, we have to regenerate the mesh, with more empty placeholders.
     * @param {gamefile} gamefile - The gamefile
     * @param {Object} options - An object containing the various properties:
     * - `regenModel`: Whether to renegerate the model of all the pieces afterward. Default: *true*.
     * - `log`: Whether to log to the console that we're adding more undefineds. Default: *false*
     */
    addMoreUndefineds: function(gamefile, { regenModel = true, log = false } = {}) {
        if (log) console.log('Adding more placeholder undefined pieces.')
        
        pieces.forEachPieceType(add)

        function add(listType) {
            if (!organizedlines.isTypeATypeWereAppendingUndefineds(gamefile, listType)) return;

            const list = gamefile.ourPieces[listType];
            const undefinedCount = list.undefineds.length;
            for (let i = undefinedCount; i < pieces.extraUndefineds; i++) organizedlines.insertUndefinedIntoList(list)
        }

        if (regenModel) piecesmodel.regenModel(gamefile, options.getPieceRegenColorArgs())
    },

    /**
     * Sees if the provided type is a type we need to append undefined
     * placeholders to the piece list of this type.
     * The mesh of all the pieces needs placeholders in case we
     * promote to a new piece.
     * @param {gamefile} gamefile - The gamefile
     * @param {string} type - The type of piece (e.g. "pawnsW")
     * @returns {boolean} *true* if we need to append placeholders for this type.
     */
    isTypeATypeWereAppendingUndefineds(gamefile, type) {
        if (!gamefile.gameRules.promotionsAllowed) throw new Error("promotionsAllowed needs to be defined before appending undefineds to the piece lists!");

        const color = math.getPieceColorFromType(type);

        if (!gamefile.gameRules.promotionsAllowed[color]) return false; // Eliminates neutral pieces.
        
        const trimmedType = math.trimWorBFromType(type);
        return gamefile.gameRules.promotionsAllowed[color].includes(trimmedType); // Eliminates all pieces that can't be promoted to
    },

    insertUndefinedIntoList: function(list) {
        const insertedIndex = list.push(undefined) - 1; // insertedIndex = New length - 1
        list.undefineds.push(insertedIndex)
    },

    buildKeyListFromState: function (state) { // state is default piece list organized by type

        const keyList = { };

        gamefileutility.forEachPieceInPiecesByType(callback, state)

        function callback (type, coords) {
            const key = math.getKeyFromCoords(coords)
            keyList[key] = type;
        }

        return keyList;
    },

    /**
     * Converts a piece list organized by key to organized by type.
     * @param {Object} keyList - Pieces organized by key: `{ '1,2': 'pawnsW' }`
     * @returns {Object} Pieces organized by type: `{ pawnsW: [ [1,2], [2,2], ...]}`
     */
    buildStateFromKeyList: function (keyList) {
        const state = organizedlines.getEmptyTypeState()

        // For some reason, does not iterate through inherited properties?
        for (const key in keyList) {
            const type = keyList[key]
            const coords = math.getCoordsFromKey(key)
            // Does the type parameter exist?
            // if (!state[type]) state[type] = []
            if (!state[type]) return console.error(`Error when building state from key list. Type ${type} is undefined!`)
            // Push the coords
            state[type].push(coords)
        }

        return state;
    },

    getEmptyTypeState() {

        const state = {}

        // White and Black
        for (let i = 0; i < pieces.white.length; i++) {
            state[pieces.white[i]] = []
            state[pieces.black[i]] = []
        }
        // Neutral
        for (let i = 0; i < pieces.neutral.length; i++) {
            state[pieces.neutral[i]] = []
        }

        return state;
    },

    /**
     * Gets a unique key from the line equation.
     * Compatable with factorable steps like `[2,2]`.
     * Discuss before changing func please as this may have unintended side-effects.
     * @param {Number[]} step Line step `[deltax,deltay]`
     * @param {Number[]} coords `[x,y]`
     * @returns {String} the key `c|smallest_x_line_intcepts`
     */
    getKeyFromLine(step, coords) {
        const C = organizedlines.getCFromLine(step, coords);
        const X = organizedlines.getXFromLine(step, coords);
        return `${C}|${X}`
    },

    /**
     * Uses the calculation of ax + by = c
     * c=b*y-intercept so is unique for each line
     * Not unique when step can be factored
     * eg [2,2]
     * @param {number[]} step - The x-step and y-step of the line: `[deltax, deltay]`
     * @param {number[]} coords - A point the line intersects: `[x,y]`
     * @returns {number} integer c
     */
    getCFromLine(step, coords) {
        return step[0]*coords[1]-step[1]*coords[0]
    },

    /**
     * Calculates the X value of the line's key from the provided step direction and coordinates.
     * This is also the nearest x value the line intersects on or after the y axis.
     * @param {number[]} step - [dx,dy]
     * @param {number[]} coords - Coordinates that are on the line
     * @returns {number} The X in the line's key: `C|X`
     */
    getXFromLine(step, coords) {
        // See these desmos graphs for inspiration for finding what line the coords are on:
        // https://www.desmos.com/calculator/d0uf1sqipn
        // https://www.desmos.com/calculator/t9wkt3kbfo

        const lineIsVertical = step[0] === 0;
        const deltaAxis = lineIsVertical ? step[1] : step[0];
        const coordAxis = lineIsVertical ? coords[1] : coords[0];
        return math.posMod(coordAxis, deltaAxis)
    },

    /**
     * Tests if the provided gamefile has colinear organized lines present in the game.
     * This can occur if there are sliders that can move in the same exact direction as others.
     * For example, [2,0] and [3,0]. We typically like to know this information because
     * we want to avoid having trouble with calculating legal moves surrounding discovered attacks
     * by using royalcapture instead of checkmate.
     * @param {gamefile} gamefile 
     */
    areColinearSlidesPresentInGame(gamefile) {
        const slidingPossible = gamefile.startSnapshot.slidingPossible; // [[1,1],[1,0]]

        // How to know if 2 lines are colinear?
        // They will have the exact same slope!

        // Iterate through each line, comparing its slope with every other line
        for (let a = 0; a < slidingPossible.length - 1; a++) {
            const line1 = slidingPossible[a]; // [dx,dy]
            const slope1 = line1[1] / line1[0]; // Rise/Run
            const line1IsVertical = isNaN(slope1);
            
            for (let b = a+1; b < slidingPossible.length; b++) {
                const line2 = slidingPossible[b]; // [dx,dy]
                const slope2 = line2[1] / line2[0]; // Rise/Run
                const line2IsVertical = isNaN(slope2);

                if (line1IsVertical && line2IsVertical) return true; // Colinear!
                if (slope1 === slope2) return true; // Colinear!
            }
        }
        return false;
    }
};

// This script allows us to enable or disable premoves and dragging pieces

import preferences from "../preferences.js";
import game from "../../../game/chess/game.js";
import premove from "../../../game/misc/premove.js";

// Document Elements -------------------------------------------------------------------------

const settingsDropdown = document.querySelector('.settings-dropdown');

const selectionDropdown = document.querySelector('.selection-dropdown');
const selectionDropdownTitle = document.querySelector('.selection-dropdown .dropdown-title');

const dragCheckbox = document.querySelector('.selection-option.drag input');
const premoveCheckbox = document.querySelector('.selection-option.premove input');

// Functions ---------------------------------------------------------------------------------

(function init() {

	showCheckmarkOnSelectedOptions();

})();

function showCheckmarkOnSelectedOptions() {
	dragCheckbox.checked = preferences.getDragEnabled();
	premoveCheckbox.checked = preferences.getPremoveEnabled();
}

function open() {
	selectionDropdown.classList.remove('visibility-hidden');
	initListeners();
	settingsDropdown.classList.add('transparent');
}
function close() {
	selectionDropdown.classList.add('visibility-hidden');
	closeListeners();
	settingsDropdown.classList.remove('transparent');
}

function initListeners() {
	selectionDropdownTitle.addEventListener('click', close);
	dragCheckbox.addEventListener("click", toggleDrag);
	premoveCheckbox.addEventListener("click", togglePremove);
}
function closeListeners() {
	selectionDropdownTitle.removeEventListener('click', close);
	dragCheckbox.removeEventListener("click", toggleDrag);
	premoveCheckbox.removeEventListener("click", togglePremove);
}

function toggleDrag() {
	preferences.setDragEnabled(dragCheckbox.checked);
}
function togglePremove() {
	preferences.setPremoveEnabled(premoveCheckbox.checked);
	if (!premoveCheckbox.checked) premove.clearPremoves(game.getGamefile());
}

export default {
	initListeners,
	closeListeners,
	close,
	open,
};
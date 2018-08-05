// ==UserScript==
// @name         Twitter Anti-Censor
// @namespace    http://github.com/JonathanGawrych
// @version      1.0
// @description  Automatically turn off the quality filter on twitter search and expand "More replies" and "Offensive replies"
// @author       JonathanGawrych
// @match        https://twitter.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/JonathanGawrych/Twitter-Anti-Censor/master/script.user.js
// ==/UserScript==

let scriptName = 'Twitter Anti-Censor - ';

(function() {
	'use strict';

	// Check if the user overrode the qf off. If they do, respect it
	let qfOverridden = location.href.indexOf('&qf=on') != -1;

	let checkForSearchCensorshipFilter = function(obj, prop) {
		// If we are searching and the censorship filter is on, turn off the censorship filter
		if (obj[prop].indexOf('/search?') != -1) {
			if (obj[prop].indexOf('&qf=') == -1) {
				let explicitOnOff = (qfOverridden ? 'on' : 'off');
				console.log(scriptName + 'checkForSearchCensorshipFilter, no qf, turning censorship filter to explicit ' + explicitOnOff);
				obj[prop] = obj[prop] + '&qf=' + explicitOnOff;
				return true;
			} else {
				console.log(scriptName + 'checkForSearchCensorshipFilter, found qf, updating cached override');
				qfOverridden = obj[prop].indexOf('&qf=on') != -1;
			}
		}
		return false;
	};

	if (checkForSearchCensorshipFilter(location, 'href')) {
		console.warn(scriptName + 'reloading the page with qf off');
	}

	// Make the on state explit rather than implicit by missing
	let qualityFilterOnOption = document.querySelector('.SidebarFilterModule-filters[data-filter-type="quality"] option[data-nav="reset_quality"]');
	if (qualityFilterOnOption != null) {
		qualityFilterOnOption.value += '&qf=on';
	}

	// if we haven't overriden, make the off option default
	let qualityFilterSelect = document.querySelector('.SidebarFilterModule-filters[data-filter-type="quality"] select');
	if (!qfOverridden && qualityFilterSelect != null) {
		qualityFilterSelect.options.selectedIndex = 1; /*off index*/
	}

	// monkeypatch history in order to run the check
	history.pushState = (function (oldPushState) {
		return function newPushState() {
			if (checkForSearchCensorshipFilter(arguments, 2 /*url*/) && !qfOverridden) {
				// Sadly just chaning the push state isn't going to change the query.
				// Just reload the page with the censorship off until I figure out how to hook their search properly
				// This might cause a few extra flashes for the user
				// This will do a censorship on search. So don't do this if qf is overridden to on
				console.warn(scriptName + 'reloading the page with qf off');
				location.href = arguments[2];
			}
			oldPushState.apply(this, arguments);
		};
	})(history.pushState);

	let overlay = document.getElementById('permalink-overlay');
	if (overlay == null) {
		console.log(scriptName + 'On subframe, not main page. Aborting');
		return;
	} else {
		console.log(scriptName + 'On main page, watching');
	}

	let config = { childList: true, subtree: true };

	let undoReplyCensorship = function(mutationsList) {

		// Something changed, see if we can load more replies
		let moreReplies = overlay.getElementsByClassName('ThreadedConversation-showMoreThreadsButton');
		if (moreReplies.length > 0) {
			console.log(scriptName + 'Found "More Replies." Loading...');
			moreReplies[0].click();
		}

		let censoredReplies = overlay.getElementsByClassName('Tombstone-action');
		if (censoredReplies.length > 0) {
			if (document.getElementById('censored-replies-header') != null) {
				// We've already done this, but our header is triggering a refire. Ignore this
				return;
			}

			console.log(scriptName + 'Found "Offensive Replies." Loading...');

			// Walk up the tree to the parent:
			let censoredParent = censoredReplies[0];
			while (censoredParent && !censoredParent.classList.contains('ThreadedConversation-showMoreThreads')) {
				censoredParent = censoredParent.parentElement;
			}

			if (censoredParent != null) {
				// We found the parent, insert the header
				let division = document.createElement('div');
				division.innerText = 'Censored Replies';
				division.className = 'ThreadedConversation--header';
				division.id = 'censored-replies-header';
				censoredParent.parentElement.insertBefore(division, censoredParent);
			}

			censoredReplies[0].click();
		}
	};

	let observer = new MutationObserver(undoReplyCensorship);

	observer.observe(overlay, config);

	// Go ahead an run once in case we are already loaded
	undoReplyCensorship();

})();

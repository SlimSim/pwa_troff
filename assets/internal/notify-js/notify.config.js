/*
	This file is part of Troff.

	Troff is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License,
	or (at your option) any later version.

	Troff is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with Troff. If not, see <http://www.gnu.org/licenses/>.
*/

// notify-js is from http://notifyjs.jpillora.com/

(function(){

	var standardHtmlNodify = "" + 
		"<div>" +
			"<div class='clearfix'>" +
				"<span class='title full-width' data-notify-html='title'/>" +
			"</div>" +
		"</div>"

	$.notify.defaults( {
		// whether to hide the notification on click
		clickToHide: true,
		// whether to auto-hide the notification
		autoHide: true,
		// if autoHide, hide after milliseconds
		autoHideDelay: 5000,
		// show the arrow pointing at the element
		arrowShow: true,
		// arrow size in pixels
		arrowSize: 5,
		// position defines the notification position though uses the defaults below
		position: null,
		// default positions
		elementPosition: 'bottom left',
		globalPosition: 'top right',
		// default style
		style: 'bootstrap',
		// default class (string or [string])
		className: 'success',
		// show animation
		showAnimation: 'slideDown',
		// show animation duration
		showDuration: 100,
		// hide animation
		hideAnimation: 'slideUp',
		// hide animation duration
		hideDuration: 50,
		// padding between element and notification
		gap: 2
	} );


	/*
	NOTE: html-info this style does not have a "notifyUndo"-function
	because I have yet not have a case for that function...
	BUT this style is used by cookie_consent.js :)
	*/
	$.notify.addStyle('html-info', { html: standardHtmlNodify });
	$.notify.addStyle('html-success', { html: standardHtmlNodify });


	window.notifyUndo = function(infoText, callback){
		var span = $("<span class=\"full-width\">")
			.append( $("<p>").text( infoText ))
			.append( $( "<button>" ).text( "undo" ).click( function() {
				callback();
				$(this).trigger('notify-hide');
			} ) );

		$.notify({
			title: span
		}, {
			style: 'html-success',
	//		autoHide: true,
			autoHideDelay: 7000,
			clickToHide: true
		});
	}


})();

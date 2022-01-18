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


$(document).ready( async function() {
	"use strict";

	/************************************************
	/*           Private methods and variables:
	/************************************************/

	let fileList = nDB.get( "TROFF_TROFF_DATA_ID_AND_FILE_NAME" );

	$.each( fileList, ( i, file ) => {

		let newDiv = $("#template").children().clone( true, true );

		newDiv.find( ".fileName" ).text( decodeURI( file.fileNameUri ) );
		newDiv.find( ".troffData" ).text( file.troffDataIdObjectList.length );
		$( "#songList" ).append( newDiv );

		$.each( file.troffDataIdObjectList, (tdIndex, troffDataIdObject ) => {

			let newTroffData = $("#troffDataTemplate").children().clone();
			newTroffData.find( ".troffDataId" )
				.text( "Download this version (" + troffDataIdObject.troffDataId + ")" )
				.attr( "href", window.location.origin + "/#" + troffDataIdObject.troffDataId + "&" + file.fileNameUri );

			newTroffData.find( ".troffDataFirstTimeLoaded" ).text( st.millisToDisp( troffDataIdObject.firstTimeLoaded ) );
			newTroffData.find( ".troffDataDisplayName" ).text( troffDataIdObject.displayName );
			newTroffData.find( ".troffDataFirstTimeLoaded" ).text( st.millisToDisp( troffDataIdObject.firstTimeLoaded ) );
			newTroffData.find( ".troffDataDisplayName" ).text( troffDataIdObject.displayName );
			newTroffData.find( ".troffDataGenre" ).text( troffDataIdObject.genre );
			newTroffData.find( ".troffDataInfo" ).text( troffDataIdObject.infoBeginning );
			newTroffData.find( ".troffDataNrMarkers" ).text( troffDataIdObject.nrMarkers );
			newTroffData.find( ".troffDataTags" ).text( troffDataIdObject.tags );

			if( troffDataIdObject.nrMarkers === undefined ) {
				newTroffData.find( ".troffDataNrMarkers" ).parent().remove();
			}

			newDiv.find( ".markerList" ).append( newTroffData );

		});

	} );


	const sortFileList = function( cssToSort, orderByAsc ) {
		orderByAsc = orderByAsc === undefined ? true : orderByAsc;
		var $fileList = $( "#fileList" );

		$fileList.children().sort(function (a, b) {
			if( orderByAsc ) {
				return $(a).data( cssToSort ) - $(b).data( cssToSort );
			}
			return $(b).data( cssToSort ) - $(a).data( cssToSort );
		})
		.appendTo( $fileList );
	}

	$( "#sortUpdatedAsc" ).on( "click", () => {	sortFileList( "updated", true ); } );
	$( "#sortUpdatedDesc" ).on( "click", () => {	sortFileList( "updated", false ); } );
	$( "#sortSizeAsc" ).on( "click", () => {	sortFileList( "fileSize", true ); } );
	$( "#sortSizeDesc" ).on( "click", () => {	sortFileList( "fileSize", false ); } );

});


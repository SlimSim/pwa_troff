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

	console.log( "history.js " );
	/************************************************
	/*           Private methods and variables:
	/************************************************/

	const superAdmin = async function( p ) {

		// const allTroffData = motsvarar alla TroffData - såklart;



		//4let fileList = [];

		let totalSize = 0;
		let nrOfFiles = 0;
		let nrOfDeletedFiles = 0;

		// fileList här motsvarar kanske det som finns i DB'n

		let fileList = nDB.get( "TROFF_TROFF_DATA_ID_AND_FILE_NAME" );

		console.log( "fileList", fileList );

		$( ".totalSize" ).text( st.byteToDisp( totalSize ) );
		$( ".nrOfFiles" ).text( nrOfFiles );
		$( ".nrOfDeletedFiles" ).text( nrOfDeletedFiles );

		// sorting latest first:
		fileList.sort( ( a, b ) => (a.updated < b.updated) ? 1 : -1 );

		$.each( fileList, ( i, file ) => {

			let newDiv = $("#template").children().clone( true, true );

			console.log( "file", file );

			//fileNameUri
			//troffDataIdObjectList


			newDiv.find( ".fileName" ).text( decodeURI( file.fileNameUri ) );
			newDiv.find( ".troffData" ).text( file.troffDataIdObjectList.length );
			$( "#songList" ).append( newDiv );


			$.each( file.troffDataIdObjectList, (tdIndex, troffDataIdObject ) => {
				//let songData = JSON.parse( troffData.markerJsonString );

				let newTroffData = $("#troffDataTemplate").children().clone();
				newTroffData.find( ".troffDataId" ).text( troffDataIdObject.troffDataId ).attr( "href", window.location.origin + "/#" + troffDataIdObject.troffDataId + "&" + file.fileNameUri );

				newTroffData.find( ".troffDataInfo" ).text( st.millisToDisp( troffDataIdObject.firstTimeLoaded ) );
				/*
				newTroffData.find( ".troffDataNrMarkers" ).text( songData.markers.length );
				newTroffData.find( ".troffDataNrStates" ).text( songData.aStates.length );
				*/

				newDiv.find( ".markerList" ).append( newTroffData );

			});

		} );


	}


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


	$( ".toggleNext" ).on( "click", ( e ) => { $( e.target ).closest( ".toggleNext" ).toggleClass( "showNext" ) } );


	superAdmin();




})


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

	console.log( "document ready");

	/************************************************
	/*           Private methods and variables:
	/************************************************/

	const app = firebase.initializeApp(environment.firebaseConfig);
  const storage = firebase.storage();
  const storageRef = storage.ref();



	const setDivToRemoved = function( div ) {
		div
			.addClass( "grayOut" )
			.removeClass( "bg-Burlywood" );
		div.find( ".removeFile" ).addClass( "hidden" )
		div.find( ".removedText" ).removeClass( "hidden" )
	};

	const superStart = async function() {

		const snapshot = await firebase.firestore().collection('TroffData').get();
		const docs = snapshot.docs;
		const allTroffData = docs.map(doc => doc.data());

		//console.log( "allTroffData", allTroffData );

		let fileList = [];

		let nrOfFiles = 0;
		let nrOfDeletedFiles = 0;

		for( const troffData of allTroffData ) {

			if( !troffData.troffDataPublic ) {
				//console.log( "troffData is not public", troffData );
				continue;
			}
			console.log( "troffData", troffData, "markerString", JSON.parse( troffData.markerJsonString ) );

			const fileUrl = troffData.fileUrl.substring(0, troffData.fileUrl.indexOf('?'))

			let miniTroffData = {
				id : troffData.id,
				markerJsonString : troffData.markerJsonString,
			}

			let currentFile = fileList.find( x => x.fileUrl == fileUrl );


			if( currentFile == undefined ) {

				/*
				const fileData = await fetch( fileUrl )
					.then(res => res.json());

				let deleted = false;
				if( fileData.error && fileData.error.code == 404 ) {
					deleted = true;
				}
				*/

				let file = {
					fileName : troffData.fileName,
					fileUrl : fileUrl,
					fileType : troffData.fileType,
					fileSize : troffData.fileSize,
					//deleted : deleted,
					//updated : fileData.updated,
					//updated : deleted ? "" : fileData.updated,
					troffData : [ miniTroffData ]
				}

				fileList.push( file );
			} else {
				currentFile.troffData.push( miniTroffData );
			}

		};

		$( ".nrOfFiles" ).text( nrOfFiles );

		// sorting latest first:
		fileList.sort( ( a, b ) => (a.updated < b.updated) ? 1 : -1 );


		$.each( fileList, ( i, file ) => {

			let newDiv = $("#template").children().clone( true, true);
			//if( file.deleted ) {
			//	return;
			//}
			newDiv.data( "updated", new Date(file.updated || 0 ).getTime() );
			newDiv.data( "fileSize", file.fileSize );
			newDiv.find( ".fileName" ).text( file.fileName ).attr( "href", file.fileUrl );
			newDiv.find( ".fileType" ).text( file.fileType );
			//newDiv.find( ".updated" ).text( file.deleted ? "" : file.updated.substr( 0, 10 ) );
			newDiv.find( ".fileSize" ).text( st.byteToDisp( file.fileSize ) );
			newDiv.find( ".troffData" ).text( file.troffData.length );
			$( "#fileList" ).append( newDiv );

			$.each( file.troffData, (tdIndex, troffData ) => {
				let songData = JSON.parse( troffData.markerJsonString );
				//console.log( "troffData", troffData, "songData", songData);

				let newTroffData = $("#troffDataTemplate").children().clone(true, true);
				newTroffData.find( ".troffDataId" ).text( troffData.id ).attr( "href", window.location.origin + "/#" + troffData.id + "&" + file.fileName );
				newTroffData.find( ".troffDataInfo" ).text( songData.info );
				newTroffData.find( ".troffDataNrMarkers" ).text( songData.markers.length );
				newTroffData.find( ".troffDataNrStates" ).text( songData.aStates.length );

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


	$( ".stOnOffButton" ).on( "click", ( e ) => { $( e.target ).closest( ".stOnOffButton" ).toggleClass( "active" ) } );

	superStart();

});


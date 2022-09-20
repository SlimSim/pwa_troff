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

	const app = firebase.initializeApp(environment.firebaseConfig);
  const storage = firebase.storage();
  const storageRef = storage.ref();

	let allTroffData;

	const setDivToRemoved = function( div ) {
		div
			.addClass( "grayOut" )
			.removeClass( "bg-Burlywood" );
		div.find( ".removeFile" ).addClass( "hidden" )
		div.find( ".removedText" ).removeClass( "hidden" )
	};

	const superStartParent = async function() {

		const snapshot = await firebase.firestore().collection('TroffData')
			.where( "troffDataPublic", "==", true )
			.get();
		const docs = snapshot.docs;
		allTroffData = docs.map(doc => doc.data());
		superStart();
	}

	const superStart = async function() {

		$( "#fileList, #deletedFileList" ).empty();

		let fileList = [];

		let totalSize = 0;
		let nrOfFiles = 0;
		let nrOfDeletedFiles = 0;

		for( const troffData of allTroffData ) {

			if( troffData.songData == undefined ) {
				troffData.songData = JSON.parse( troffData.markerJsonString );
				delete troffData.markerJsonString;
			}

			//if( troffData.fileName != "Welcome To Jurassic Park.mp3" ) continue;

			let customName = "";
			let choreography = "";
			let title = "";
			const fileName = troffData.fileName || "";
			if( troffData.songData.fileData ) {
				customName = troffData.songData.fileData.customName || "";
				choreography = troffData.songData.fileData.choreography || "";
				title = troffData.songData.fileData.title || "";
			}

			const search = $("#search").val().toLowerCase();
			const includesSearch = fileName.toLowerCase().includes( search ) ||
					customName.toLowerCase().includes( search ) ||
					choreography.toLowerCase().includes( search ) ||
					title.toLowerCase().includes( search )

			if( !includesSearch ) {
				continue;
			}

			const fileUrl = troffData.fileUrl.substring(0, troffData.fileUrl.indexOf('?'))

			let currentFile = fileList.find( x => x.fileUrl == fileUrl );

			const fileDataLastModified = troffData.songData.fileData ? troffData.songData.fileData.lastModified : undefined;
			troffData.troffDataUploadedMillis = troffData.troffDataUploadedMillis || fileDataLastModified;

			if( currentFile == undefined ) {

				let file = {
					fileName : troffData.fileName,
					fileUrl : fileUrl,
					fileType : troffData.fileType,
					fileSize : troffData.fileSize,
					deleted : troffData.deleted,
					updated : troffData.troffDataUploadedMillis,
					troffDataList : [ troffData ]
				}

				fileList.push( file );
			} else {
				if( troffData.deleted ) {
					currentFile.deleted = true;
				}

				if( currentFile.updated == undefined || troffData.troffDataUploadedMillis < currentFile.updated ) {
					currentFile.updated = troffData.troffDataUploadedMillis;
				}

				currentFile.troffDataList.push( troffData );
			}

		};

		$( ".nrOfFiles" ).text( nrOfFiles );

		// sorting latest first:
		fileList.sort( ( a, b ) => (a.updated < b.updated) ? 1 : -1 ); // updated does not exist


		$.each( fileList, ( i, file ) => {

			let newDiv = $("#template").children().clone( true, true);
			newDiv.data( "updated", new Date(file.updated || 0 ).getTime() );
			newDiv.data( "fileSize", file.fileSize );
			newDiv.find( ".fileName" ).text( file.fileName ).attr( "href", file.fileUrl );
			newDiv.find( ".fileType" ).text( file.fileType );
			newDiv.find( ".updated" ).text( st.millisToDisp( file.updated ) );
			newDiv.find( ".fileSize" ).text( st.byteToDisp( file.fileSize ) );
			newDiv.find( ".troffDataLength" ).text( file.troffDataList.length );

			if( file.deleted ) {
				newDiv.removeClass( "tertiaryColor" ).addClass( "accentColor2" );
				$( "#deletedFileList" ).append( newDiv );
				nrOfDeletedFiles++;
			} else {
				nrOfFiles++;
				totalSize += file.fileSize;
				$( "#fileList" ).append( newDiv );
			}

			$.each( file.troffDataList, (tdIndex, troffData ) => {

				let displayName = file.fileName
				let genre = "";
				let tags = "";
				if( troffData.songData.fileData ) {
					displayName = troffData.songData.fileData.customName ||
							troffData.songData.fileData.choreography ||
							troffData.songData.fileData.title ||
							file.fileName;
					genre = troffData.songData.fileData.genre || "";
					tags = troffData.songData.fileData.tags || "";
				}

				let newTroffData = $("#troffDataTemplate").children().clone(true, true);
				newTroffData.find( ".troffDataId" )
					.text( "Download this version (" + troffData.id + ")"   )
					.attr( "href", window.location.origin + "/#" + troffData.id + "&" + file.fileName );

				newTroffData.find( ".troffDataInfo" ).text( troffData.songData.info.substring( 0, 99 ) );
				newTroffData.find( ".troffDataNrMarkers" ).text( troffData.songData.markers.length );
				if( troffData.songData.aStates.length == 0 ) {
					$( ".troffDataNrStatesParent" ).addClass( "hidden" )
				}
				newTroffData.find( ".troffDataNrStates" ).text( troffData.songData.aStates.length );
				newTroffData.find( ".troffDataFirstTimeLoaded" ).text( st.millisToDisp( troffData.troffDataUploadedMillis ) );
				newTroffData.find( ".troffDataDisplayName" ).text( displayName );
				newTroffData.find( ".troffDataGenre" ).text( genre );
				newTroffData.find( ".troffDataTags" ).text( tags );

				newDiv.find( ".markerList" ).append( newTroffData );

			});

		} );

		$( ".nrOfFiles" ).text( nrOfFiles );
		$( ".totalSize" ).text( st.byteToDisp( totalSize ) );
		$( ".nrOfDeletedFiles" ).text( nrOfDeletedFiles );

		$( "#loadingArticle" ).addClass( "hidden" );
		$( "#mainArticle" ).removeClass( "hidden" );
		if( nrOfDeletedFiles > 0 ) {
			$( "#showDeletedButt" ).removeClass( "hidden" );
		}
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
	$( "#showDeletedButt" ).on( "click", () => {	$( "#deletedFileListParent" ).toggleClass( "hidden" );  } );

	$( "#buttSearch" ).on( "click", superStart );


	$( ".stOnOffButton" ).on( "click", ( e ) => { $( e.target ).closest( ".stOnOffButton" ).toggleClass( "active" ) } );
	$("#search").keyup( function( event ) {
		if ( event.keyCode === 13 ) {
			$("#buttSearch").click();
		}
	});


	superStartParent();

});


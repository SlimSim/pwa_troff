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

	let serverSongListHistory;

	const initiateApp = async function() {
		serverSongListHistory = nDB.get( "TROFF_TROFF_DATA_ID_AND_FILE_NAME" );
		const savedServerSongListFromServer = nDB.get( "TROFF_SERVER_SONG_LIST_FROM_SERVER" );
		mergeWithServerSongListHistory( savedServerSongListFromServer );

		let filter = new URLSearchParams( window.location.hash.slice( 1 ) ).get( "f" );
		if( filter == "my" ) {
			$( "#sortMoreInfoSwitch" ).click();
			$( "#filterOnlyHistoryButt" ).click();
		}

		repopulateFileListDivs();
		scrollToUrlSong();

		const snapshot = await firebase.firestore().collection('TroffData')
			.where( "troffDataPublic", "==", true )
			.get();
		const docs = snapshot.docs;
		const allTroffDataFromServer = docs.map(doc => doc.data());
		let latestServerSongListFromServer = troffDataListToServerSongList( allTroffDataFromServer );
		nDB.set( "TROFF_SERVER_SONG_LIST_FROM_SERVER", latestServerSongListFromServer );

		if(
			savedServerSongListFromServer == null ||
			savedServerSongListFromServer.length != latestServerSongListFromServer.length ||
			!savedServerSongListFromServer.every( a => latestServerSongListFromServer.some( b => serverSongEqual(a, b) ) )
		) {
			// latestServerSongListFromServer contains new updates compared to savedServerSongListFromServer!
			mergeWithServerSongListHistory( latestServerSongListFromServer );
			repopulateFileListDivs();
			scrollToUrlSong();
		}

	}

	const scrollToUrlSong = function() {
		let id = new URLSearchParams( window.location.hash.slice( 1 ) ).get("id");
		if( id ) {
			let element =  document.getElementById( fileNameToId( decodeURI( id ) ) );
			if( element ) {
				element.scrollIntoView();
				element.querySelector( ".toggleNext" ).click();
			}
		}
	}

	const fileNameToId = function( fileName ) {
		return fileName.split( ' ' ).join( '_' );
	}

	const serverSongEqual = function( ss1, ss2 ) {
		if( ss1.fileNameUri != ss2.fileNameUri ) return false;
		if( ss1.troffDataIdObjectList.length != ss2.troffDataIdObjectList.length ) return false;
		return ss1.troffDataIdObjectList.every( tdio1 =>
			ss2.troffDataIdObjectList.some( tdio2 => tdio1.troffDataId == tdio2.troffDataId )
		);
	}

	const mergeWithServerSongListHistory = function( serverSongListFromServer ) {

		if( serverSongListFromServer == undefined ) {
			return;
		}
		if( serverSongListHistory == undefined ) {
			serverSongListHistory = [];
		}

		serverSongListFromServer.forEach( ssFromServer => {

			const ssHistory = serverSongListHistory.find( hss => hss.fileNameUri == ssFromServer.fileNameUri );

			if( ssHistory == undefined ) {
				ssFromServer.fromServer = true;
				ssFromServer.troffDataIdObjectList.forEach( tdio => tdio.fromServer = true );
				serverSongListHistory.push( ssFromServer );
			} else {
				ssHistory.deleted = [ssHistory.deleted, ssFromServer.deleted].some( a => a );
				ssHistory.size = ssHistory.size || ssFromServer.size;
				ssHistory.type = ssHistory.type || ssFromServer.type;
				ssHistory.uploaded = getEarliestTime( ssHistory.uploaded, ssFromServer.uploaded );

				ssFromServer.troffDataIdObjectList.forEach( tdioFromServer => {
					const tdioHistory = ssHistory.troffDataIdObjectList.find( tdio => tdio.troffDataId == tdioFromServer.troffDataId );

					if( tdioHistory == undefined ) {
						tdioFromServer.fromServer = true;
						ssHistory.troffDataIdObjectList.push( tdioFromServer );
					} else {
						tdioHistory.firstTimeLoaded = tdioHistory.firstTimeLoaded || tdioFromServer.firstTimeLoaded;
						tdioHistory.displayName = tdioHistory.displayName || tdioFromServer.displayName;
						tdioHistory.nrMarkers = tdioHistory.nrMarkers || tdioFromServer.nrMarkers;
						tdioHistory.infoBeginning = tdioHistory.infoBeginning || tdioFromServer.infoBeginning;
						tdioHistory.genre = tdioHistory.genre || tdioFromServer.genre;
						tdioHistory.tags = tdioHistory.tags || tdioFromServer.tags;
					}

				} );
			}

		} )

	};

	const troffDataListToServerSongList = function( troffDataList ) {
		let serverSongList = [];

		for( const troffData of troffDataList ) {

			const fileNameUri = encodeURI( troffData.fileName );

			let currentServerSong = serverSongList.find( ss => ss.fileNameUri == fileNameUri );

			if( currentServerSong == undefined ) {
				const serverSong = {
					fileNameUri : fileNameUri,
					deleted : troffData.deleted != undefined ? troffData.deleted : false,
					size : troffData.fileSize,
					type : troffData.fileType,
					uploaded : troffData.troffDataUploadedMillis,
					troffDataIdObjectList : [ troffDataToTroffDataIdObject( troffData ) ]
				};
				serverSongList.push( serverSong );
			} else {
				if( troffData.deleted ) {
					currentServerSong.deleted = true;
				}
				currentServerSong.uploaded = getEarliestTime( currentServerSong.uploaded, troffData.troffDataUploadedMillis );
				currentServerSong.troffDataIdObjectList.push( troffDataToTroffDataIdObject( troffData ) );
			}

		}

		return serverSongList;
	}

	const repopulateFileListDivs = function() {
		$( "#fileList, #deletedFileList" ).empty();

		$.each( serverSongListHistory, ( i, serverSong ) => {

			let newDiv = $("#serverSongTemplate").children().clone( true, true );

			const fileName = decodeURI( serverSong.fileNameUri )
			newDiv.attr( "id", fileNameToId( fileName ) );
			if( serverSong.fromServer ) {
				newDiv.addClass( "fromServer" );
			}
			newDiv.data( "fileName", fileName );
			newDiv.data( "uploaded", new Date( serverSong.uploaded || 0 ).getTime());
			newDiv.data( "fileSize", serverSong.size || 0)
			newDiv.find( ".fileName" ).text( fileName );
			newDiv.find( ".newSong" ).toggleClass( "hidden", !serverSong.fromServer );
			newDiv.find( ".uploaded" ).text( st.millisToDisp( serverSong.uploaded ) );
			newDiv.find( ".fileType" ).text( serverSong.type );
			newDiv.find( ".fileSize" ).text( st.byteToDisp( serverSong.size ) );
			if( serverSong.type != "" && serverSong.type != null ) {
				newDiv.find( ".fileTypeSizeSeparator" ).removeClass( "hidden" );
			}

			newDiv.find( ".troffDataLength" ).text( serverSong.troffDataIdObjectList.length );
			newDiv.toggleClass( "grayOut", !!serverSong.deleted ); // <-- !! converts undefined and null to false :)

			let addNewDiv = false;
			let defaultValue = false;
			if( fileName.toLowerCase().includes( $( "#search" ).val().toLowerCase() ) ) {
				defaultValue = true;
			}
			$.each( serverSong.troffDataIdObjectList, (tdIndex, troffDataIdObject ) => {
				if( !includesSearch( $( "#search" ).val(), troffDataIdObject, defaultValue ) ) {
					return;
				}
				addNewDiv = true;

				let newTroffDataDiv = getFullTroffDataDiv( troffDataIdObject, serverSong.fileNameUri );
				newDiv.find( ".markerList" ).append( newTroffDataDiv );
			});
			if( !addNewDiv ) {
				return;
			}
			if( !!serverSong.deleted ) {
				$( "#showDeletedButt" ).removeClass( "hidden" );
				$( "#deletedFileList" ).append( newDiv );
			} else {
				$( "#fileList" ).append( newDiv );
			}

		} );

		$( "#loadingArticle" ).addClass( "hidden" );
		$( "#mainArticle" ).removeClass( "hidden" );

	};

	const getEarliestTime = function( m1, m2 ) {
		if( m1 == undefined && m2 == undefined ) return 0;

		if( (m1 == undefined || m1 < 162431283500) && m2 > 162431283500 ) return m2;
		if( (m2 == undefined || m2 < 162431283500) && m1 > 162431283500 ) return m1;

		if( (m1 == undefined || m1 < 162431283500) && (m2 == undefined || m2 < 162431283500) ) return 0;
		return Math.min( m1, m2 );
	}

	const getFirstTimeLoadedFromTroffData = function( troffData ) {
		const millis = troffData.troffDataUploadedMillis;
		if( !(!millis || millis < 162431283500 ) ) {
			return millis;
		}
		if( troffData.songData && troffData.songData.fileData && troffData.songData.fileData.lastModified ) {
			return troffData.songData.fileData.lastModified;
		}
		return 0;
	}

	const troffDataToTroffDataIdObject = function( troffData ) {
		if( troffData.songData == undefined ) {
			troffData.songData = JSON.parse( troffData.markerJsonString );
			delete troffData.markerJsonString;
		}
		return {
			troffDataId : troffData.id,
			firstTimeLoaded : getFirstTimeLoadedFromTroffData ( troffData ),
			displayName : getDisplayNameFromTroffData( troffData ),
      nrMarkers : troffData.songData.markers.length,
      nrStates : troffData.songData.aStates ? troffData.songData.aStates.length : 0,
      infoBeginning : troffData.songData.info.substring( 0, 99 ),
      genre : ( troffData.songData.fileData && troffData.songData.fileData.genre ) || "",
      tags : ( troffData.songData.fileData && troffData.songData.fileData.tags ) || ""
		};
	}

	const getFullTroffDataDiv = function( troffDataIdObject, fileNameUri ) {
		let newTroffData = $("#troffDataTemplate").children().clone(true, true);
		const downloadText = troffDataIdObject.fromServer ? "for the first time" : "again";
		newTroffData.find( ".troffDataId" )
			.text( "Download this version " + downloadText + " (" + troffDataIdObject.troffDataId + ")" )
			.attr( "href", window.location.origin + "/#" + troffDataIdObject.troffDataId + "&" + fileNameUri );

		if( troffDataIdObject.fromServer ) {
			newTroffDataDiv.addClass( "fromServer" );
		}

		newTroffData.find( ".troffDataInfo" ).text( troffDataIdObject.infoBeginning );
		if( !troffDataIdObject.nrMarkers ) {
			newTroffData.find( ".troffDataNrMarkersParent" ).addClass( "hidden" );
		}
		newTroffData.find( ".troffDataNrMarkers" ).text( troffDataIdObject.nrMarkers );
		if( troffDataIdObject.nrStates > 0 ) {
			newTroffData.find( ".troffDataNrStatesParent" ).removeClass( "hidden" )
		}
		newTroffData.find( ".troffDataNrStates" ).text( troffDataIdObject.nrStates );
		newTroffData.find( ".troffDataFirstTimeLoaded" ).text( st.millisToDisp( troffDataIdObject.firstTimeLoaded ) );
		newTroffData.find( ".troffDataDisplayName" ).text( troffDataIdObject.displayName );
		newTroffData.find( ".troffDataGenre" ).text( troffDataIdObject.genre );
		newTroffData.find( ".troffDataTags" ).text( troffDataIdObject.tags );
		return newTroffData;
	};

	const pathToName = function( filepath ) {
		let lastIndex = filepath.lastIndexOf( '.' );
		if( lastIndex == -1 ) {
			return filepath;
		}
		return filepath.substr( 0, lastIndex );
	};

	const getDisplayNameFromTroffData = function( troffData, defaultValue ) {
		let displayName = defaultValue || pathToName( troffData.fileName );
		if( troffData.songData && troffData.songData.fileData ) {
			displayName = troffData.songData.fileData.customName ||
					troffData.songData.fileData.choreography ||
					troffData.songData.fileData.title ||
					defaultValue;
		}

		return displayName;
	}

	const getSearchableFields = function( troffDataIdObject ) {
		let customName = "";
		let choreography = "";
		let displayName = troffDataIdObject.displayName || "";
		let genre = troffDataIdObject.genre || "";
		let tags = troffDataIdObject.tags || "";
		return [customName, choreography, displayName, genre, tags];
	}

	const includesSearch = function( text, troffDataIdObject, defaultValue ) {
		if( text == "" ) return true;
		text = text.toLowerCase();
		const searchableFields = getSearchableFields( troffDataIdObject );
		if( searchableFields.every( f => f == "" ) ) {
			return defaultValue;
		}

		return searchableFields.map( t => {
		 	return t.toLowerCase().includes( text )
		 }).some( a => a );
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

	$( ".stOnOffButton" ).on( "click", ( e ) => { $( e.target ).closest( ".stOnOffButton" ).toggleClass( "active" ) } );
	$( "#sortUploadedAsc" ).on( "click", () => {	sortFileList( "uploaded", true ); } );
	$( "#sortUploadedDesc" ).on( "click", () => {	sortFileList( "uploaded", false ); } );
	$( "#sortSizeAsc" ).on( "click", () => {	sortFileList( "fileSize", true ); } );
	$( "#sortSizeDesc" ).on( "click", () => {	sortFileList( "fileSize", false ); } );
	$( "#showDeletedButt" ).on( "click", () => {	$( "#deletedFileListParent" ).toggleClass( "hidden" );  } );
	$( "#filterOnlyHistoryButt" ).on( "click", () =>
		$( "#fileList, #deletedFileList" ).toggleClass( "hideFromServer", $( "#filterOnlyHistoryButt" ).hasClass("active") )
	);

	$( "#buttSearch" ).on( "click", repopulateFileListDivs );

	$("#search").keyup( function( event ) {
		if ( event.keyCode === 13 ) {
			$("#buttSearch").click();
		}
	});

	initiateApp();

});


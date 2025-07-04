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

// todo: try to use the strict mode! :)
// - what could possibly go wrong?
// "use strict";


let firebaseUser = null;


const app = firebase.initializeApp(environment.firebaseConfig),
	auth = app.auth(),
	storage = app.storage();

SongToGroup.initiateFromDb();

SongToGroup.onSongAdded( (event)=> {
	const songKey = event.detail.songKey;

	$( "#dataSongTable" )
		.find( `[data-song-key="${songKey}"]` )
		.addClass( "groupIndication" );

	if( Troff.getCurrentSong() == songKey ) {
		$( ".groupIndicationDiv" )
			.addClass( "groupIndication" );
	}

});

const googleSignIn = function() {
	if ( isSafari ) {
		IO.alert(
			"Safari and iOS does not support sign in",
			"If you want to sign in and use shared songlists and more, " +
			"please switch to a supported browser, such as Firefox, Chromium or Chrome.<br /><br />" +
			"Best of luck!"
		);
		return;
	}

	auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
		.then(result => {
			// Signed in successfully
			firebaseUser = result.user;
			setUiToSignIn(firebaseUser);
			initiateAllFirebaseGroups();
		})
		.catch(error => {
			// Handle Errors here.
			log.e('Error during sign-in:', error);
		});
};

const signOut = function() {
	auth.signOut().then(() => {
		// Sign-out successful
		// ui will be reset by the auth.onAuthStateChanged-function
	}).catch(error => {
		// An error happened.
		log.e('Error during sign-out:', error);
	});
};

const initiateAllFirebaseGroups = async function() {
	firebase.firestore()
		.collection( 'Groups' )
		.where( "owners", "array-contains", firebaseUser.email)
		.get()
		.then( initiateCollections );
}

const initiateCollections = async function( querySnapshot ) {

	if( querySnapshot.metadata.fromCache ) {
		// If the result is from the cache,
		// we dont want to update the DB with the result!
		return;
	}

	SongToGroup.clearMap();

	await Promise.all( querySnapshot.docs.map( async doc => {
		const subCollection = await doc.ref.collection( "Songs" ).get();

		doc.ref.onSnapshot( groupDocUpdate );
		const group = doc.data();

		const songListObject = {
			name : group.name,
			firebaseGroupDocId : doc.id,
			owners : group.owners,
			color : group.color,
			icon : group.icon,
			songs : []
		};

		subCollection.forEach( songDoc => {
			songListObject.songs.push({
				galleryId : 'pwa-galleryId',
				fullPath : songDoc.data().songKey,
				firebaseSongDocId : songDoc.id
			});

			SongToGroup.quickAdd(
				doc.id,
				songDoc.id,
				songDoc.data().songKey,
				songDoc.data().fileUrl
			);

			songDoc.ref.onSnapshot( songDocUpdate );
		});

		const exists = $("#songListList")
			.find( `[data-firebase-group-doc-id="${doc.id}"]` )
			.length;

		if( exists == 0 ) {
			Troff.addSonglistToHTML_NEW( songListObject );
		} else {
			Troff.updateSongListInHTML( songListObject );
		}
		DB.saveSonglists_new();

		$("#songListList")
			.find( `[data-firebase-group-doc-id="${doc.id}"]` )
			.addClass( "verrified-in-firebase" );

	} ) );

	$("#songListList")
		.find( `[data-firebase-group-doc-id]` )
		.not( `.verrified-in-firebase`)
		.each( (i, v) => {
			const groupDocId = $( v ).data( "firebase-group-doc-id" );
			setGroupAsSonglist(groupDocId);
		} );

	SongToGroup.saveToDb();

}

const setGroupAsSonglist = function(groupDocId) {
	SongToGroup.remove( undefined, groupDocId);

	DB.setSonglistAsNotGroup( groupDocId );

	const $target = $("#songListList")
		.find( `[data-firebase-group-doc-id="${groupDocId}"]` );
	if( $target.length == 0 ) {
		return;
	}

	$target.removeClass( "groupIndication" );
	$target.attr( "data-firebase-group-doc-id", null);

	const songList = $target.data( "songList" );
	if( songList == undefined ) {
		return;
	}

	delete songList.firebaseGroupDocId;
	delete songList.owners;
	$target.data( "songList", songList );

}

const groupDocUpdate = function( doc ) {

	if( !doc.exists ) {
		setGroupAsSonglist(doc.id);
		return;
	}

	const group = doc.data();
	const $target = $("#songListList")
		.find( `[data-firebase-group-doc-id="${doc.id}"]` );

	if( !group.owners.includes( firebaseUser.email ) ) {
		setGroupAsSonglist(doc.id);

		$.notify(
			`You have been removed from the group "${$target.text()}".
			It has been converted to a songlist`,
			"info"
		);
		return;
	}

	const songListObject = $target.data( "songList" );

	Object.entries(group).forEach(([key, value]) => {
		songListObject[key] = value
	});

	Troff.updateSongListInHTML( songListObject );

	DB.saveSonglists_new();

}

// onSongUpdate, onSongDocUpdate <- i keep searching for theese words so...
const songDocUpdate = async function( doc ) {
	const songDocId = doc.id;
	const groupDocId = doc.ref.parent.parent.id;

	if( !doc.exists ) {
		const fileName = SongToGroup.getFileNameFromSongDocId( songDocId );
		const groupName = $( `[group-id="${groupDocId}"]`).text();
		$.notify(
			`The song "${fileName}" has been removed from the group
			${groupName}
			\nBut the song and markers are still saved on your computer!`,
			"info"
		);

		SongToGroup.remove(songDocId, undefined);
		removeGroupIndicationIfSongInNoGroup( fileName );
		return;
	}

	const songData = doc.data();
	const songKey = songData.songKey;

	const songExists = await fileHandler.doesFileExistInCache( songKey );

	if( !(songExists ) ) {
		try {
			await fileHandler.fetchAndSaveResponse(
				songData.fileUrl,
				songKey );
		} catch ( error ) {
			return errorHandler.fileHandler_fetchAndSaveResponse(
				error,
				songKey
				);
		}
		addItem_NEW_2( songKey );
		$.notify( songKey + " was successfully added" );
	}

	const fileUrl = songData.fileUrl;
	const existingMarkerInfo = nDB.get( songKey );
	const newMarkerInfo = JSON.parse( songData.jsonDataInfo );



	const existingUploadTime = existingMarkerInfo?.latestUploadToFirebase;
	const firebaseUploadTime = newMarkerInfo.latestUploadToFirebase;

	const songHaveLocalChanges = DB.popSongWithLocalChanges(
		groupDocId,
		songDocId,
		songKey
	);

	if( existingUploadTime == firebaseUploadTime ) {
		// firestore does NOT have any new updates:
		if( songHaveLocalChanges ) {
			// But there is local updates that should be pushed to firestore:
			saveSongDataToFirebaseGroup(
				songKey,
				groupDocId,
				songDocId
			);
		}

		return;

	}

	if( Troff.getCurrentSong() == songKey ) {
		if( !doc.metadata.hasPendingWrites ) {
			// The update has troffData that is not from this computer
			// should replace the current troffData without interupting
			// the current activity
			replaceTroffDataWithoutInterupt( songData );
		}
	}

	newMarkerInfo.localInformation = existingMarkerInfo?.localInformation;
	if( songHaveLocalChanges ) {
		$.notify(
			`The song ${songKey} had local changes that where overwritten`,
			{
				className: 'info',
				autoHide: false,
				clickToHide: true
			}
		);
		// (och kanske spara undan dom markörerna i en temp-grejj om man vill ta in dom igen??? eller för komplicerat?)
	}

	nDB.set( songKey, newMarkerInfo );

	SongToGroup.add(groupDocId, songDocId, songKey, fileUrl);

}

const replaceTroffDataWithoutInterupt = function( songData ) {
	const serverTroffData = JSON.parse( songData.jsonDataInfo );

	// Update tempo:
	$( "#tapTempo" ).val( serverTroffData.TROFF_VALUE_tapTempo );

	// Update the states:
	Troff.clearAllStates();
	Troff.addButtonsOfStates(serverTroffData.aStates);

	// Update the markers:
	const currentMarkerId = $( '.currentMarker' ).attr('id');
	const currentStopMarkerId = $( '.currentStopMarker' ).attr('id');
	$( "#markerList" ).children().remove();
	Troff.addMarkers(serverTroffData.markers);
	$( '.currentMarker' ).removeClass( "currentMarker" );
	$( '.currentStopMarker' ).removeClass( "currentStopMarker" );
	$( "#" + currentMarkerId ).addClass( "currentMarker" );
	$( "#" + currentStopMarkerId ).addClass( "currentStopMarker" );
	Troff.setAppropriateActivePlayRegion();

	// Update the Song info:
	if( !$( "#songInfoArea").is( ":focus" ) ) {
		Troff.setInfo( serverTroffData.info );
	}

	// Update the current marker info:
	if( !$( "#markerInfoArea").is( ":focus" ) ) {
		$( "#markerInfoArea")
			.val( $("#" + currentMarkerId )[0].info );
	}
}

const removeGroupIndicationIfSongInNoGroup = function( songKey ) {
	if( SongToGroup.getNrOfGroupsThisSongIsIn( songKey ) > 0 ) {
		return;
	}

	$( "#dataSongTable" )
		.find( `[data-song-key="${songKey}"]` )
		.removeClass( "groupIndication" );

	if( Troff.getCurrentSong() != songKey ) {
		return;
	}

	$( ".groupIndicationDiv" )
		.removeClass( "groupIndication" );
}


/**
 * Gets the data in the group that is sent to firebase!
 * IE it does NOT include the songLIstObjectId,
 * because that is
 */
const getFirebaseGroupDataFromDialog = function( forceUserEmail ) {

	const owners = [];
	$("#groupOwnerParent" ).find(".groupDialogOwner")
		.each( (i, v) => {
			owners.push( $( v ).val() );
	} );

	if( forceUserEmail && !owners.includes( firebaseUser.email ) ) {
		owners.push( firebaseUser.email );
	}

	const groupData = {
		name : $( "#groupDialogName" ).val(),
		owners : owners
	};

	return groupData;

}

const groupDialogSave = async function( event ) {

	if ( !$( "#buttAttachedSongListToggle").hasClass( "active" ) ) {
		$( "#buttAttachedSongListToggle").click();
	}

	const isGroup = $( "#groupDialogIsGroup" ).is( ":checked" );
	let groupDocId = $( "#groupDialogName" ).data( "groupDocId" );

	const songListObject = {
		id : $( "#groupDialogName" ).data( "songListObjectId" ),
		name : $( "#groupDialogName" ).val(),
		color : $( "#groupDialogColor" ).val(),
		icon : $( "#groupDialogIcon" ).val(),
		info : $( "#groupDialogInfo" ).val(),
	};

	if( isGroup ) {
		const owners = [];
		$("#groupOwnerParent" ).find(".groupDialogOwner")
			.each( (i, v) => {
				owners.push( $( v ).val() );
		} );

		if( !owners.includes( firebaseUser.email ) ) {
			owners.push( firebaseUser.email );
		}
		songListObject.owners = owners;

		// copying songListObject to groupData without references!
		const groupData = JSON.parse(JSON.stringify(songListObject));
		delete groupData.id;

		if( groupDocId != null ) {
			await firebase.firestore()
				.collection( 'Groups' )
				.doc( groupDocId )
				.set( groupData );
		} else {
			const groupRef = await firebase.firestore()
				.collection( 'Groups' )
				.add( groupData );

			groupRef.onSnapshot( groupDocUpdate );

			groupDocId = groupRef.id;
		}


		songListObject.firebaseGroupDocId = groupDocId;

	}

	const songs = [];
	$( "#groupSongParent" ).find( "input" ).each( async ( i, v ) => {
		const songKey = $( v ).val();


		const galleryId = $( v ).data( "galleryId" );
		const songDocId = $( v ).data( "firebaseSongDocId" );

		const songIdObject = {
			fullPath : songKey,
			galleryId : galleryId,
			firebaseSongDocId : songDocId
		}

		if( songKey == "" ) {
			return;
		}


		if (isGroup) {
			if( $( v ).hasClass( "removed" ) ) {
				if( songDocId == undefined ) {
					return;
				}
				removeSongFromFirebaseGroup(songKey, groupDocId, songDocId);
				return;
			}
			saveSongDataToFirebaseGroup( songKey, groupDocId, songDocId );
		}
		if ( $( v ).hasClass( "removed" )  ) {
			return;
		}

		songs.push(  songIdObject );
	} );
	songListObject.songs = songs;

	if ( songListObject.id == undefined ) {
		Troff.addSonglistToHTML_NEW( songListObject );
	} else {
		Troff.updateSongListInHTML( songListObject );
	}
	DB.saveSonglists_new();
}

const removeSongFileFromFirebaseGroupStorage = async function (
	groupDocId,
	storageFileName) {
	return new Promise( function( resolve, reject) {
		let storageRef = firebase.storage()
			.ref("Groups/" + groupDocId + "/" + storageFileName);

		storageRef.delete().then(() => {
			resolve();
			}).catch((error) => {
				log.e(
					storageFileName + " could not be deleted!",
					error );
				reject();
			});
	});

}

const removeSongDataFromFirebaseGroup = function(
	groupDocId,
	songDocId) {

	return firebase.firestore()
		.collection( 'Groups' )
		.doc( groupDocId )
		.collection( "Songs" )
		.doc( songDocId )
		.delete();
}

const removeSongFromFirebaseGroup = async function(
	songKey,
	groupDocId,
	songDocId) {

	return new Promise( async function( resolve, reject) {
		await removeSongDataFromFirebaseGroup(groupDocId, songDocId);

		const fileUrl = SongToGroup.songKeyToFileUrl(
			songKey,
			groupDocId,
			songDocId );

		const storageFileName = fileUrlToStorageFileName( fileUrl );

		await removeSongFileFromFirebaseGroupStorage( groupDocId, storageFileName );
		resolve();
	} );
};

const onOnline = function() {
	// this timeOut is because I want to wait untill possible existing
	// firestore updates get synced to the ego-computer.
	// because then Ego-offline-changes should be overwritten.
	setTimeout( () => {
		const changedSongList = nDB.get( "TROFF_SONGS_WITH_LOCAL_CHANGES" ) || [];
		// This is to send local changes IF the server does NOT
		// have new updates
		changedSongList.forEach( changedSong => {
			firebase.firestore()
				.collection( 'Groups' )
				.doc( changedSong.groupDocId )
				.collection( "Songs" )
				.doc( changedSong.songDocId )
				.get()
				.then( songDocUpdate );
			// There is 2 callbacks,
			// it is because firebase is beign updated and the
			// it sends out the update-calblack, so all in good order!
		});
	}, 42);

};

const saveSongDataToFirebaseGroup = async function(
	songKey,
	groupDocId,
	songDocId ) {

	const publicData = Troff.removeLocalInfo( nDB.get( songKey ) );

	publicData.latestUploadToFirebase = Date.now();

	const songData = {
		songKey : songKey,
		jsonDataInfo : JSON.stringify( publicData )
	};

	if( songDocId != undefined ) {

		songData.fileUrl = SongToGroup.songKeyToFileUrl(
			songKey,
			groupDocId,
			songDocId);

		if( navigator.onLine ) {
			firebase.firestore()
				.collection( 'Groups' )
				.doc( groupDocId )
				.collection( "Songs" )
				.doc( songDocId )
				.set( songData );
		} else {
			$.notify(
				"You are offline, your changes will be synced online once you come online!",
				{
					className: 'info',
					autoHide: false,
					clickToHide: true
				}
			);

			DB.pushSongWithLocalChanges( groupDocId, songDocId, songKey );
		}

	} else {
		songData.fileUrl = await uploadSongToFirebaseGroup(
			groupDocId,
			songKey
			);


		// TODO! kolla att jag är online!
		//songData.latestUploadToFirebase = Date.now();


		let docRef = await firebase.firestore()
			.collection( 'Groups' )
			.doc( groupDocId )
			.collection( "Songs" )
			.add( songData );

		SongToGroup.add(groupDocId, docRef.id, songKey, songData.fileUrl);

		docRef.onSnapshot( songDocUpdate );
		const songList = $( "#songListList" )
			.find(`[data-firebase-group-doc-id="${groupDocId}"]`)
			.data( "songList" );

		songList.songs.forEach( song => {
			if( song.fullPath == songKey ) {
				song.firebaseSongDocId = docRef.id
			}
		});

		$( "#songListList" )
			.find(`[data-firebase-group-doc-id="${groupDocId}"]`)
			.data( "songList", songList );

	}
};

const uploadSongToFirebaseGroup = async function(
	groupId,
	songKey ) {

	const [fileUrl, file] = await fileHandler
		.sendFileToFirebase( songKey, "Groups/"+ groupId );
	return fileUrl;

}

/*
vilka låtar har fileUrl?

de låtar som jag laddar upp?
	- nej
låtar som jag laddar ner
	- ja!
*/



/*
 * If this sing is in a group,
 * update the info in firestore for that gruop
 */
const ifGroupSongUpdateFirestore = function( songKey ) {
	const firestoreIdentifierList = SongToGroup.getSongGroupList(songKey);
	if( firestoreIdentifierList == undefined ) {
		return;
	}

	// If this song is in no groups =>
	// firestoreIdentifierList will be undefined and
	// ?. will simply return undefined instead of craching...
	firestoreIdentifierList?.forEach( fi => {
		saveSongDataToFirebaseGroup(
			songKey,
			fi.groupDocId,
			fi.songDocId);
	});

}


auth.onAuthStateChanged( user => {
	firebaseUser = user;
	if( user == null ) {
		setUiToNotSignIn();
		return;
	}

	// The signed-in user info.
	setUiToSignIn( firebaseUser );
	initiateAllFirebaseGroups();
});

const fileUrlToStorageFileName = function( downloadUrl ) {
	const urlNoParameters = downloadUrl.split("?")[0];
	const partList = urlNoParameters.split( "%2F" );

	// return last part, which is the file-name!
	return partList[ partList.length -1 ];
};

const mergeSongHistorys = function( song1, song2 ) {
	if( song1 == null ) return song2;
	if( song2 == null ) return song1;

	const song = { fileNameUri : song1.fileNameUri };

	const tdioList = song1.troffDataIdObjectList;

	song2.troffDataIdObjectList.forEach( tdio => {
		if (tdioList.some(td => td.troffDataId === tdio.troffDataId)) {
			/* Troffdata already in troffDataIdObjectList */
			return;
		}
		tdioList.push( tdio );
	});
	song.troffDataIdObjectList = tdioList;
	return song;
}

const mergeSongListHistorys = function( songList1, songList2 ){
	if( songList1 == null && songList2 == null ) return [];
	if( songList1 == null ) return songList2;
	if( songList2 == null ) return songList1;

	const mergedSongList = [];
	songList1.forEach( song1 => {
		const song2 = songList2
			.find( s => s.fileNameUri == song1.fileNameUri );
		mergedSongList.push( mergeSongHistorys( song1, song2) );
	});

	// adding the songs from songList2 that was not in songList1
	// (and thus not handled in the above forEach):
	songList2.forEach( song2 => {
		const song1 = songList1
			.find( s => s.fileNameUri == song2.fileNameUri );
		if( song1 == undefined ) {
			mergedSongList.push( song2 );
		}
	});

	return mergedSongList;
}


function setSong2(/*fullPath, galleryId*/ path, type, songData ){

	Troff.pauseSong();

	if( $( "#TROFF_SETTING_SONG_LIST_CLEAR_ON_SELECT" ).hasClass( "active" ) ) {
		$("#dataSongTable_filter").find( "input" ).val('');
		$('#dataSongTable').DataTable().search('').draw();
	}

	var exitOnSelect = $( "#TROFF_SETTING_SONG_LIST_EXIT_ON_SELECT" ).hasClass( "active" ),
		floatingDialog = $( "#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG" ).hasClass( "active" );

	if( exitOnSelect && floatingDialog ) {
		closeSongDialog();
	}

	DB.setCurrentSong(path, "pwa-galleryId");

	Troff.setWaitForLoad(path, "pwa-galleryId");
	//fs.root.getFile(path, {create: false}, function(fileEntry) {

	var newElem = null;
	// show the file data
	clearContentDiv();
	var type = getFileType(path); //varför gör jag detta? jag har ju redan type!!!

	if (type == "image")
		newElem = addImageToContentDiv();
	else if (type == "audio")
		newElem = addAudioToContentDiv();
	else if (type == "video")
		newElem = addVideoToContentDiv();

	if ( !newElem ) {
		log.e( "setSong2: newElem is not defined!" );
		IO.removeLoadScreen();
		return;
	}
	// TODO: metadata? finns det något sätt jag kan få fram metadata från filerna?
	$( "#currentPath" ).text( path );

	$( "#downloadSongFromServerInProgressDialog" ).addClass( "hidden" );

	//Safari does not play well with blobs as src :(
	if( isSafari && false ) {
		log.d( "isSafari", isSafari, nDB );

	  let troffData = nDB.get( path );
	  if( troffData.localInformation && troffData.localInformation.addedFromThisDevice ) {
		log.d( "setSong2: in if 1");
			newElem.setAttribute('src', songData );
	  } else if( troffData.fileUrl != undefined ) {
		log.d( "setSong2: in if 2");
			newElem.setAttribute('src', troffData.fileUrl );

			// if first time loading the song, don't show alert :)
			if( troffData.localInformation && troffData.localInformation.nrTimesLoaded > 5 ) {
				IO.alert(
					"Please add file manually",
					"This file has been downloaded, " +
					"and will not work offline. You can solve this in two ways:<br />" +
					"1) Add the file called<br /><br />" + path + "<br /><br />" +
					"with the "+
					"<label " +
						"title=\"Add songs, videos or pictures to Troff\"" +
						"class=\"cursor-pointer mr-2 regularButton fa-stack Small full-height-on-mobile\"" +
						"for=\"fileUploader\">" +
							"<i class=\"fa-music fa-stack-10x m-relative-7 font-size-relative-1\"></i>" +
							"<i class=\"fa-plus fa-stack-10x m-relative-4 font-size-relative-65\"></i>" +
					"</label>" +
					"-button at the top of the song-dialog or <br /><br />"+
					"2) Switch to a supported browser, such as Firefox, Chromium or Chrome.<br /><br />" +
					"Best of luck!"
				);
			}

		} else {
			newElem.setAttribute('src', songData );
		}
		newElem.load();
		newElem.pause();
	} else {
		log.d( "in else");
		log.d("songData " + (typeof songData))
		log.d("songData " + songData, nDB)
		//för vanlig linux, bäst att använda songData hela tiden :)
		newElem.setAttribute('src', songData );
	}

	const localInfo = nDB.get( path ).localInformation || {};
	const nrTimesLoaded = localInfo.nrTimesLoaded || 0;
	nDB.setOnSong( path, ["localInformation", "nrTimesLoaded"], nrTimesLoaded + 1 );

	updateVersionLink( path );

	updateGroupNotification( path );
} //end setSong2

function updateGroupNotification( songKey ) {
	const nrGroups = SongToGroup.getNrOfGroupsThisSongIsIn( songKey )
	if( nrGroups == 0 ) {
		$( "#currentGroupsParent" ).addClass( "hidden" );
		$( ".groupIndicationDiv" ).removeClass( "groupIndication" );
		return;
	}
	$( "#currentGroupsParent" ).removeClass( "hidden" );

	$( ".groupIndicationDiv" ).addClass( "groupIndication" );

	$( ".currentNrGroups" ).text( nrGroups );

	const groups = SongToGroup.getSongGroupList(songKey);

	const groupNames = groups.map( group => {
		return $( "#songListList" )
			.find( `[data-firebase-group-doc-id="${group.groupDocId}"]` )
			.text();
	});

	$( "#currentNrGroupsPluralS" ).toggleClass( "hidden", nrGroups == 1 );

	$( "#currentGroups" ).empty();
	groupNames.forEach( name => {
		$( "#currentGroups" ).append(
			$( "<li>" ).addClass("pt-2").text( name )
		);
	});


};

function updateVersionLink( path ) {
	const fileNameUri = encodeURI( path );

	function hideVersionLink( number ) {
		$( ".nr-of-versions-in-history" ).text( 0 );
		$( ".nr-of-versions-in-history-parent" ).addClass( "hidden" );
		return;
	}

	dbHistory = nDB.get( "TROFF_TROFF_DATA_ID_AND_FILE_NAME" );
	if( dbHistory == null ) {
		return hideVersionLink( 0 );
	}

	let hist = dbHistory.filter( h => h.fileNameUri == fileNameUri );

	if( hist.length == 0 || hist[0].troffDataIdObjectList == null || hist[0].troffDataIdObjectList.length == 0 ) {
		return hideVersionLink( 0 );
	}

	if( hist[0].troffDataIdObjectList.length == 1 && nDB.get( path ).serverId != undefined ) {
		// hiding the history-link since there is only one version, ant that version is in use now
		return hideVersionLink( 1 );
	}

	$( ".nr-of-versions-in-history" )
		.text( hist[0].troffDataIdObjectList.length );
	$( ".nr-of-versions-in-history-parent" )
		.attr( "href", "find.html#f=my&id=" + fileNameUri )
		.removeClass( "hidden" );
}


function clickSongList_NEW( event ) {
	IO.blurHack();
	var $target = $(event.target),
		data = $target.data("songList"),
		galleryId = $target.attr("data-gallery-id"),
		fullPath = $target.attr("data-full-path");

	$( "#songListAll" ).removeClass( "selected" );

	if( $("#TROFF_SETTING_SONG_LIST_ADDITIVE_SELECT").hasClass( "active" ) ) {

		if( data || galleryId ) {
			$target.toggleClass( "active" );
			$( "#songListsList" ).find( "button" ).removeClass("selected");
		} else {
			// It only enters here IF the All songs-button is pressed :)
			$( "#songListsList" ).find( "button" ).removeClass("selected").removeClass("active");
			$target.addClass("selected");
		}
	} else {
		$( "#songListsList" ).find( "button" ).removeClass("selected").removeClass("active");
		$target.addClass( "selected" );

		$( "#headArea" ).removeClassStartingWith( "bg-" );
		$( "#songlistIcon" ).removeClassStartingWith( "fa-" );
		$( "#songlistName" ).text( "" );
		$( "#songlistInfo" ).text( "" ).addClass( "hidden" );

		if( data && data.firebaseGroupDocId ) {
			$( "#headArea" ).addClass( data.color );
			$( "#songlistIcon" ).addClass( data.icon || "fa-users" );
			$( "#songlistName" ).text( data.name );
			$( "#songlistInfo" ).removeClass( "hidden" ).text( data.info );
		}
	}

	Troff.saveCurrentStateOfSonglists();

	filterSongTable( getFilterDataList() );

}


async function createSongAudio( path ) {
	let songIsV2;
	try {
		songIsV2 = await cacheImplementation.isSongV2( path )
	} catch ( e ) {
		return errorHandler.fileHandler_fetchAndSaveResponse( new ShowUserException(`The song "${path}" does not exist.
			if you have the file named "${path}", you can
			simply import it again and the markers will be connected with the file!` ) );
	}

	if( songIsV2 ) {
		try {
			var songData = await cacheImplementation.getSong( path );

			setSong2( path, "audio", songData );
		} catch (e) {
			log.e("error: No song selected yet: ", e);
		}
	} else {
		try {
			let v3SongObjectUrl = await fileHandler.getObjectUrlFromFile( path );
			setSong2( path, "audio", v3SongObjectUrl );
		} catch ( e ) {
			errorHandler.fileHandler_sendFile( e );
		}
	}

};

function addItem_NEW_2( key ) {

	var galleryId = "pwa-galleryId";
	var extension = getFileExtension( key );
	var faType = getFileTypeFaIcon( key );

	var selected_path = Troff.getCurrentSong();
	var selected_galleryId = Troff.getCurrentGalleryId();

	var dataInfo = {
		"galleryId" : galleryId,
		"fullPath" : key
	};

	const strDataInfo = JSON.stringify( dataInfo );
	const thisSongAlreadyAdded = $('#dataSongTable').DataTable().column( DATA_TABLE_COLUMNS.getPos( "DATA_INFO" ) )
		.data().toArray().includes( strDataInfo );
	if( thisSongAlreadyAdded ) {
		return;
	}

	DB.getVal( key, function( song ) {

		var tempo = "",
			info = "",
			duration =  sortAndValue( 0, "" ),
			lastModified = "",
			size = "",
			customName = "",
			choreography = "",
			choreographer = "",
			title = "",
			artist = "",
      album = "",
      genre = "",
      tags = "",
      titleOrFileName = "";

		if( song != undefined ) {
			if( song.TROFF_VALUE_tapTempo != undefined ) tempo = song.TROFF_VALUE_tapTempo;
			if( song.info != undefined ) info = song.info;
		}

		if( song && song.fileData ) {
			if( song.fileData.duration ) {
				duration = sortAndValue( song.fileData.duration, Troff.secToDisp( song.fileData.duration ) )
			}
			if( song.fileData.lastModified ) {
				lastModified = st.millisToDisp( song.fileData.lastModified );
			}
			if( song.fileData.size ) {
				size = sortAndValue( song.fileData.size, st.byteToDisp( song.fileData.size ) );
			}
			customName = song.fileData.customName;
			choreography = song.fileData.choreography;
			choreographer = song.fileData.choreographer;
			title = song.fileData.title;
			artist = song.fileData.artist;
			album = song.fileData.album;
			genre = song.fileData.genre;
			tags = song.fileData.tags;
		}

		titleOrFileName = customName || choreography || title || Troff.pathToName( key );

		let columns = [];

		columns[ DATA_TABLE_COLUMNS.getPos( "DATA_INFO" ) ] = strDataInfo,
    columns[ DATA_TABLE_COLUMNS.getPos( "TYPE" ) ] = sortAndValue(faType, "<i class=\"fa " + faType + "\"></i>"),//type
    columns[ DATA_TABLE_COLUMNS.getPos( "DURATION" ) ] = duration,//Duration
    columns[ DATA_TABLE_COLUMNS.getPos( "DISPLAY_NAME" ) ] = titleOrFileName,
    columns[ DATA_TABLE_COLUMNS.getPos( "CUSTOM_NAME" ) ] = customName,
    columns[ DATA_TABLE_COLUMNS.getPos( "CHOREOGRAPHY" ) ] = choreography || "",
    columns[ DATA_TABLE_COLUMNS.getPos( "CHOREOGRAPHER" ) ] = choreographer || "",
    columns[ DATA_TABLE_COLUMNS.getPos( "TITLE" ) ] = title || "",
    columns[ DATA_TABLE_COLUMNS.getPos( "ARTIST" ) ] = artist || "",
    columns[ DATA_TABLE_COLUMNS.getPos( "ALBUM" ) ] = album || "",
    columns[ DATA_TABLE_COLUMNS.getPos( "TEMPO" ) ] = tempo || "",
    columns[ DATA_TABLE_COLUMNS.getPos( "GENRE" ) ] = genre || "",
    columns[ DATA_TABLE_COLUMNS.getPos( "TAGS" ) ] = tags || "",
    columns[ DATA_TABLE_COLUMNS.getPos( "LAST_MODIFIED" ) ] = lastModified,
    columns[ DATA_TABLE_COLUMNS.getPos( "FILE_SIZE" ) ] = size,
    columns[ DATA_TABLE_COLUMNS.getPos( "INFO" ) ] = info,
    columns[ DATA_TABLE_COLUMNS.getPos( "EXTENSION" ) ] = "." + extension
		var newRow = $('#dataSongTable').DataTable().row.add( columns )
		//.onClick => .on('click', 'tbody tr', function(event) i funktionen initSongTable
		//						onSongLoad [loadedmetadata] finns i, addAudioToContentDiv och addVideoToContentDiv (dom anropar bla setMetadata)
		.draw( false )
		.node();

		// todo: remove DATA_INFO and use this data-song-key instead!
		$( newRow ).attr( "data-song-key", key );
		if( SongToGroup.getNrOfGroupsThisSongIsIn( key ) > 0 ) {
			$( newRow ).addClass( "groupIndication" );
		}

		if(selected_path == key && selected_galleryId == galleryId){
			$("#dataSongTable").find("tbody tr").removeClass("selected");
			$( newRow ).addClass( "selected" );
		}

	} ); // end DB.getVal
}


/**
 * Denna funktion används när envändaren själv lägger till låtar i en songList
 * antingen via drag and drop, eller selecten
 * Den används INTE om groupDialog sparas,
 * eller om låtarna läggs till via en firebase update!
 * @param {array of songs} songs
 * @param {jQuery button} $target
 */
export function addSongsToSonglist( songs, $target ) {
	var	songAlreadyExists,
		songList = $target.data("songList");

	$.each( songs, function(i, song) {
		var dataInfo = song.data || song;
		songAlreadyExists = songList.songs.filter(function(value, index, arr){
			return value.galleryId == dataInfo.galleryId &&
				value.fullPath == dataInfo.fullPath;
		} ).length > 0;

		if( songAlreadyExists ) {
			$.notify( song.fullPath + " is already in " + songList.name, "info" );
			return;
		}


		songList.isDirectory = false;
		songList.songs.push( song );

		$target.data("songList", songList);

		notifyUndo( dataInfo.fullPath + " was added to " + songList.name, function(){
			var i,
				undo_songList = $target.data("songList");

			undo_songList.songs = undo_songList.songs.filter(function(value, index, arr){
				return !(value.galleryId == dataInfo.galleryId &&
					value.fullPath == dataInfo.fullPath);
			});

			DB.saveSonglists_new();
		} );
		const groupDocId = $target.data( "firebaseGroupDocId");
		if (groupDocId != undefined) {
			const songDocId = undefined;
			saveSongDataToFirebaseGroup(
				dataInfo.fullPath,
				groupDocId,
				songDocId );
		}
	});
	DB.saveSonglists_new();
}



//******************************************************************************
//* End FS - File System ----------------------------------------------------- *
//******************************************************************************


var Troff = new TroffClass();
var DB = new DBClass();
var IO = new IOClass();
var Rate = new RateClass();

// Make globals available for browser compatibility
if (typeof window !== 'undefined') {
  window.Troff = Troff;
  window.DB = DB;
  window.IO = IO;
  window.Rate = Rate;
  window.addSongsToSonglist = addSongsToSonglist;
}

// Export for ES6 module usage
export { Troff, DB, IO, Rate };


loadExternalHtml = function(includes, callback) {
	if( includes.length == 0 ) {
		return callback();
	}
	const currentElement = includes.eq(-1);
	includes.splice( includes.length-1, 1);

	const file = $( currentElement ).data('include');
	$( currentElement ).load( file, function(){
		loadExternalHtml( includes, callback );
	} );
}

window.addEventListener('hashchange',  Troff.checkHashAndGetSong );

$(document).ready( async function() {

	if( isIpad || isIphone ) {
		$( "#TROFF_SETTING_UI_VOLUME_SLIDER_SHOW" ).removeClass( "active" );
	}

	setTimeout( () => {
		// don't show tha load-screen for more than 10-seconds
		// (so that it will be removed even if something breaks)
		IO.removeLoadScreen();
	}, 10000 );

	// include external HTML-files:

	const includes = $('[data-include]');
	loadExternalHtml(includes, async function() {
		initSongTable();

		DB.cleanDB();
		DB.getAllSonglists();
		DB.getZoomDontShowAgain();
		IO.startFunc();
		Rate.startFunc();

		Troff.initFileApiImplementation();
		Troff.recallCurrentStateOfSonglists();

		DB.getShowSongDialog();
		initEnvironment();

		Troff.checkHashAndGetSong();

		firebaseWrapper.onUploadProgressUpdate = function( progress ) {
			$( "#uploadPercentDone" ).text( Math.trunc( progress ) );
		};
		firebaseWrapper.onDownloadProgressUpdate = function( progress ) {
			$( "#downloadPercentDone" ).text( Math.trunc( progress ) );
		};

	});
});

function initEnvironment() {
	"use strict";


	$.getJSON( "manifest.json", function( manifest ) {
		$( ".app-version-number" ).text( manifest.version );
	});

	if( environment.banner.show ) {
		$( "#banner" ).removeClass( "hidden" );
		$( "#banner" ).find( "#banner-text" ).text( environment.banner.text );
	}

	if( environment.showHiddenInProd ) {
		$( ".hidden-in-prod" )
				.removeClass( "hidden" )
				.removeClass( "hidden-in-prod" );
	}
}

$.fn.removeClassStartingWith = function (filter) {
	$(this).removeClass(function (index, className) {
		return (className.match(new RegExp("\\S*" + filter + "\\S*", 'g')) || []).join(' ')
	});
	return this;
};


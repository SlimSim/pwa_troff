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

	const app = firebase.initializeApp(environment.firebaseConfig),
		//database = app.database(),
		auth = app.auth(),
		storage = app.storage(),
		storageRef = storage.ref();


	const googleSignIn = function() {
		auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
	}

	const setDivToRemoved = function( div ) {
		div
			.addClass( "grayOut" )
			.removeClass( "bg-Burlywood" );
		div.find( ".removeFile" ).addClass( "hidden" )
		div.find( ".removedText" ).removeClass( "hidden" )
	};

	const removeFileFromServer = async function( fileUrl, newDiv ) {

		// Create a reference to the file to delete
		const fileData = await fetch( fileUrl )
			.then(res => res.json());

		if( fileData.error && fileData.error.code == 404 ) {
			// file is already removed...
			setDivToRemoved( newDiv );
			return;
		}
		const desertRef = storageRef.child( fileData.name );

		// Delete the file
		desertRef.delete().then( () => {
			setDivToRemoved( newDiv );
		})
		.catch( ( error ) => {
			$( "#alertDialog" ).removeClass( "hidden" );
			$( "#alertHeader" ).text( "Error" );
			$( "#alertText" ).text( "Could not remove: " + error );
			console.error( error );
		});
	};

	const updateTroffDataOnServer = function( troffData ) {
		const db = firebase.firestore();
		return db.collection( "TroffData" ).doc( String( troffData.id ) ).set( troffData )
			.then( x => {
				return troffData;
			})
			.catch( (error) => {
				console.error( "updateTroffDataOnServer: catch error", error );
				$( "#alertDialog" ).removeClass( "hidden" );
				$( "#alertHeader" ).text( "Error" );
				$( "#alertText" ).text( "Could not update Troff Data On Server: " + error );
			});
	}

	const markTroffDataDeletedOnServer = function( troffData ) {
		troffData.deleted = true;
		return updateTroffDataOnServer( troffData );
	};

	const markTroffDataPrivateOnServer = function( troffData ) {
		troffData.troffDataPublic = false;
		return updateTroffDataOnServer( troffData );
	};
	const markTroffDataPublicOnServer = function( troffData ) {
		troffData.troffDataPublic = true;
		return updateTroffDataOnServer( troffData );
	};

	const superAdmin = async function( p ) {
		const d = ["vdUz7MqtIWd6EJMPW1sV6RNQla32", "2bQpoKUPSVS7zW54bUt2AMvFdYD2", "5D1r1lWfbnbC1zcbAuyjFJDMmrj1", "v0LuGf9ccjW0wWERWmBKwx1BiH83", "OD3MRzoRJHXBvBZksZHLnrLn58n2", "6KHeS82V28c4PR1nwAH6rlBNDO72", "bX7aEd5T5AgTt1gZIZQJgloOckL2", "iP27JMxnEuPjZG7GgLQxddizxVF3", "f99yGdVUImOS2BXd1RNUv0zOkxq1" ];

		if( !d.includes( p ) ) {
			$( ".showForUnauthorised" ).removeClass( "hidden" );
			$( ".showForNewUsers" ).addClass( "hidden" );
			$( ".showForLoggedInUsers" ).addClass( "hidden" );
			return;
		}

		const snapshot = await firebase.firestore().collection('TroffData')
			//.where( "troffDataPublic", "==", true )
			//.where( "fileName", "==", "A Tiger.mp3" )
			//.where( "id", "==", 860081095 )
			.get();
		const docs = snapshot.docs;
		const allTroffData = docs.map(doc => doc.data());



		let fileList = [];

		let totalSize = 0;
		let nrOfFiles = 0;
		let nrOfDeletedFiles = 0;

		for( const troffData of allTroffData ) {
			const fileUrl = troffData.fileUrl.substring(0, troffData.fileUrl.indexOf('?'));
			let currentFile = fileList.find( x => x.fileUrl == fileUrl );

			if( currentFile == undefined ) {
				const fileData = ( troffData.markerJsonString ? JSON.parse( troffData.markerJsonString ).fileData : {} ) || {};

				let file = {
					fileName : troffData.fileName,
					fileUrl : fileUrl,
					fileType : troffData.fileType,
					fileSize : troffData.fileSize,
					deleted : troffData.deleted,
					updated : troffData.deleted ? "" : ( (new Date( fileData.lastModified ) ).toJSON()  || "" ),
					troffDataList : [ troffData ]
				}
				if( !troffData.deleted ) {
					totalSize += troffData.fileSize;
					nrOfFiles++;
				} else {
					nrOfDeletedFiles++;
				}

				fileList.push( file );
			} else {
				currentFile.troffDataList.push( troffData );
			}

		};

		$( ".totalSize" ).text( st.byteToDisp( totalSize ) );

		$( ".nrOfFiles" ).text( nrOfFiles );
		$( ".nrOfDeletedFiles" ).text( nrOfDeletedFiles );

		// sorting latest first:
		fileList.sort( ( a, b ) => (a.updated < b.updated) ? 1 : -1 );


		$.each( fileList, ( i, file ) => {

			let newDiv = $("#template").children().clone( true, true );
			let atLeastOneTroffDataIsDeleted = false;
			let atLeastOneTroffDataIsNotDeleted = false;
			let nrTroffDataPublic = 0;
			let nrTroffDataPrivate = 0;

			if( file.deleted ) {
				setDivToRemoved( newDiv );
			}
			newDiv.data( "updated", new Date(file.updated || 0 ).getTime() );
			newDiv.data( "fileSize", file.fileSize );
			newDiv.find( ".fileName" ).text( file.fileName ).attr( "href", file.fileUrl );
			newDiv.find( ".fileType" ).text( file.fileType );
			newDiv.find( ".updated" ).text( file.deleted ? "" : file.updated.substr( 0, 10 ) );
			newDiv.find( ".fileSize" ).text( st.byteToDisp( file.fileSize ) );
			newDiv.find( ".troffData" ).text( file.troffDataList.length );
			$( "#fileList" ).append( newDiv );

			$.each( file.troffDataList, (i, troffData ) => {
				let songData = null;
				try {
					songData = JSON.parse( troffData.markerJsonString );
				}
				catch (e) {
					console.error( "Error parsing troffData.markerJsonString, troffData:", troffData );
					console.error( "    .... Error:", e );
					return ;
				}

				let newTroffData = $("#troffDataTemplate").children().clone(true, true);

				if( troffData.deleted ) {
					atLeastOneTroffDataIsDeleted = true;
				} else {
					atLeastOneTroffDataIsNotDeleted = true;
				}
				if( troffData.troffDataPublic ) {
					newTroffData.find( ".troffDataPublicOrPrivate" ).text( "Public" );
					nrTroffDataPublic++;
				} else {
					newTroffData.find( ".troffDataPublicOrPrivate" ).text( "Private" );
					nrTroffDataPrivate++;
					newTroffData.find( ".troffDataMakePrivate" ).addClass( "hidden" );
					newTroffData.find( ".troffDataMakePublic" ).removeClass( "hidden" );
				}

				newTroffData.find( ".troffDataMakePrivate" ).on( "click", () => {
					markTroffDataPrivateOnServer( troffData );
					newTroffData.find( ".troffDataMakePrivate" ).addClass( "hidden" );
          newTroffData.find( ".troffDataMakePublic" ).removeClass( "hidden" );
					newDiv.find( ".troffDataPublic" ).text( Number( newDiv.find( ".troffDataPublic" ).text() ) - 1 );
					newDiv.find( ".troffDataPrivate" ).text( Number( newDiv.find( ".troffDataPrivate" ).text() ) + 1 );
					newTroffData.find( ".troffDataPublicOrPrivate" ).text( "Private" );

				});
				newTroffData.find( ".troffDataMakePublic" ).on( "click", () => {
					markTroffDataPublicOnServer( troffData );
					newTroffData.find( ".troffDataMakePrivate" ).removeClass( "hidden" );
          newTroffData.find( ".troffDataMakePublic" ).addClass( "hidden" );
					newDiv.find( ".troffDataPublic" ).text( Number( newDiv.find( ".troffDataPublic" ).text() ) + 1 );
					newDiv.find( ".troffDataPrivate" ).text( Number( newDiv.find( ".troffDataPrivate" ).text() ) - 1 );
					newTroffData.find( ".troffDataPublicOrPrivate" ).text( "Public" );
				});
				newTroffData.find( ".troffDataId" ).text( troffData.id ).attr( "href", window.location.origin + "/#" + troffData.id + "&" + file.fileName );
				newTroffData.find( ".troffDataInfo" ).text( songData.info );
				newTroffData.find( ".troffDataNrMarkers" ).text( songData.markers.length );
				newTroffData.find( ".troffDataNrStates" ).text( songData.aStates.length );

				newDiv.find( ".markerList" ).append( newTroffData );

			});

			if( atLeastOneTroffDataIsDeleted && atLeastOneTroffDataIsNotDeleted ) {
				// If at Least One TroffData Is Deleted, then all troffData should be deleted, and the song should be removed
				// so if at Least One TroffData Is Not Deleted, then they should be removed! :)
				removeFileFromServer( file.fileUrl, newDiv );
				file.troffDataList.forEach( markTroffDataDeletedOnServer );
			}

			newDiv.find( ".troffDataPublic" ).text( nrTroffDataPublic );
			newDiv.find( ".troffDataPrivate" ).text( nrTroffDataPrivate );

			newDiv.find( ".removeFile" ).on( "click", () => {
				document.getElementById( "blur-hack" ).focus({ preventScroll: true });

				st.confirm('Delete file?', 'Do you want to delete the file "' + file.fileName + '" on the server?\n' +
					'Note, all the markers will still be available.', function() {
					removeFileFromServer( file.fileUrl, newDiv );
					file.troffDataList.forEach( markTroffDataDeletedOnServer );
				} );

			} );
			newDiv.find( ".makeAllPrivate" ).on( "click", () => {
				document.getElementById( "blur-hack" ).focus({ preventScroll: true });
				st.confirm('Make All Private?', 'Do you want to make all the troffData private for "' + file.fileName + '"?',
				function() {
					file.troffDataList.forEach( markTroffDataPrivateOnServer );
					newDiv.find( ".troffDataMakePrivate" ).addClass( "hidden" );
					newDiv.find( ".troffDataMakePublic" ).removeClass( "hidden" );
					newDiv.find( ".troffDataPublic" ).text( 0 );
					newDiv.find( ".troffDataPrivate" ).text( file.troffDataList.length );
					newDiv.find( ".troffDataPublicOrPrivate" ).text( "Private" );
				} );
			} );
			newDiv.find( ".makeAllPublic" ).on( "click", () => {
				document.getElementById( "blur-hack" ).focus({ preventScroll: true });
				st.confirm('REALLY? Make All PUBLIC?', 'Do you want to make ALL the troffData PUBLIC for "' + file.fileName + '"?',
				function() {
					file.troffDataList.forEach( markTroffDataPublicOnServer );
					newDiv.find( ".troffDataMakePrivate" ).removeClass( "hidden" );
					newDiv.find( ".troffDataMakePublic" ).addClass( "hidden" );
					newDiv.find( ".troffDataPublic" ).text( file.troffDataList.length );
					newDiv.find( ".troffDataPrivate" ).text( 0 );
					newDiv.find( ".troffDataPublicOrPrivate" ).text( "Public" );
				} );
			} );

		} );


	}

	const setUiToSignIn = function( user )  {
		$( ".showForNewUsers" ).addClass( "hidden" );
		$( ".showForLoggedInUsers" ).removeClass( "hidden" );
		$( "#userName" ).text( user.displayName );
		$( "#userEmail" ).text( user.email );
		$( "#userPhoneNumber" ).text( user.phoneNumber );
	}

	const setUiToNotSignIn = function () {
		$( ".showForNewUsers" ).removeClass( "hidden" );
		$( ".showForLoggedInUsers" ).addClass( "hidden" );
		$( "#userName" ).val( "" );
		$( "#userEmail" ).val( "" );
		$( "#userPhoneNumber" ).val( "" );
	}

	const signOut = function() {
		auth.signOut().then( setUiToNotSignIn ).catch((error) => {
			// An error happened.
		});
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

	$( "#googleSignIn" ).on( "click", googleSignIn );
	$( "#signOut" ).on( "click", signOut );

	auth.onAuthStateChanged((user) => {
		if( user == null ) {
			return;
		}
		
		// The signed-in user info.
		setUiToSignIn( user );
		superAdmin( user.uid );
	});

	//firebase.auth().getRedirectResult()
	auth.getRedirectResult().then((result) => {
		if( !result.credential) {
    		return setUiToNotSignIn();
		}

		/** @type {firebase.auth.OAuthCredential} */
		var credential = result.credential;

		// This gives you a Google Access Token. You can use it to access the Google API.
		var token = credential.accessToken;

		// The signed-in user info.
		var user = result.user;

		setUiToSignIn( user );

		superAdmin( user.uid );

  }).catch((error) => {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    // The email of the user's account used.
    var email = error.email;
    // The firebase.auth.AuthCredential type that was used.
    var credential = error.credential;

    $( "#alertDialog" ).removeClass( "hidden" );
    $( "#alertHeader" ).text( "Error" );
    $( "#alertText" ).text( "could not authenticate: " + error.code + ", " + errorMessage );

  });

	$( ".stOnOffButton" ).on( "click", ( e ) => { $( e.target ).closest( ".stOnOffButton" ).toggleClass( "active" ) } );

});


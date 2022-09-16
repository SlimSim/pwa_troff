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


	const googleSignIn = function() {
		var provider = new firebase.auth.GoogleAuthProvider();
		firebase.auth().signInWithRedirect(provider);
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

	const markTroffDataDeletedOnServer = function( troffData ) {

		troffData.deleted = true;

		const db = firebase.firestore();
		return db.collection( "TroffData" ).doc( String( troffData.id ) ).set(troffData)
			.then( x => {
				return troffData;
			})
			.catch( (error) => {
				console.log( "markTroffDataDeletedOnServer: catch error", error );
				$( "#alertDialog" ).removeClass( "hidden" );
				$( "#alertHeader" ).text( "Error" );
				$( "#alertText" ).text( "Could not mark Troff Data Deleted On Server: " + error );
			});
	};

	const superAdmin = async function( p ) {
		const d = ["vdUz7MqtIWd6EJMPW1sV6RNQla32", "2bQpoKUPSVS7zW54bUt2AMvFdYD2", "5D1r1lWfbnbC1zcbAuyjFJDMmrj1" ];

		if( p.includes( d ) ) {
			$( ".showForUnauthorised" ).removeClass( "hidden" );
			$( ".showForNewUsers" ).addClass( "hidden" );
			$( ".showForLoggedInUsers" ).addClass( "hidden" );
			return;
		}

		const snapshot = await firebase.firestore().collection('TroffData').get();
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
				console.log( "fileData", fileData);

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

			let newDiv = $("#template").children().clone( true, true);
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
				let songData = JSON.parse( troffData.markerJsonString );

				let newTroffData = $("#troffDataTemplate").children().clone(true, true);
				newTroffData.find( ".troffDataId" ).text( troffData.id ).attr( "href", window.location.origin + "/#" + troffData.id + "&" + file.fileName );
				newTroffData.find( ".troffDataInfo" ).text( songData.info );
				newTroffData.find( ".troffDataNrMarkers" ).text( songData.markers.length );
				newTroffData.find( ".troffDataNrStates" ).text( songData.aStates.length );

				newDiv.find( ".markerList" ).append( newTroffData );

			});

			newDiv.find( ".removeFile" ).on( "click", () => {
				document.getElementById( "blur-hack" ).focus({ preventScroll: true });

				st.confirm('Delete file?', 'Do you want to delete the file "' + file.fileName + '" on the server?\n' +
					'Note, all the markers will still be available.', function() {
					removeFileFromServer( file.fileUrl, newDiv );
					file.troffDataList.forEach( markTroffDataDeletedOnServer );
				} );

			} );

		} );


	}

	const signOut = function() {
		firebase.auth().signOut().then(() => {
			// Sign-out successful.

			$( ".showForNewUsers" ).removeClass( "hidden" );
			$( ".showForLoggedInUsers" ).addClass( "hidden" );

			$( "#userName" ).val( "" );
			$( "#userEmail" ).val( "" );
			$( "#userPhoneNumber" ).val( "" );
		}).catch((error) => {
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



	firebase.auth().getRedirectResult()
  .then((result) => {

    if( !result.credential) {
    $( ".showForNewUsers" ).removeClass( "hidden" );

    	return signOut();
		}

		/** @type {firebase.auth.OAuthCredential} */
		var credential = result.credential;

		// This gives you a Google Access Token. You can use it to access the Google API.
		var token = credential.accessToken;

    // The signed-in user info.
    var user = result.user;

    $( ".showForNewUsers" ).addClass( "hidden" );
    $( ".showForLoggedInUsers" ).removeClass( "hidden" );

    $( "#userName" ).text( user.displayName );
    $( "#userEmail" ).text( user.email );
    $( "#userPhoneNumber" ).text( user.phoneNumber );

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


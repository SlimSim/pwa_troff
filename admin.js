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

	const superAdmin = async function( p ) {
		const d = ["vdUz7MqtIWd6EJMPW1sV6RNQla32", "2bQpoKUPSVS7zW54bUt2AMvFdYD2", "5D1r1lWfbnbC1zcbAuyjFJDMmrj1" ];

		if( p.includes( d ) ) {
			$( ".showForUnauthorised" ).removeClass( "hidden" );
			$( ".showForNewUsers" ).addClass( "hidden" );
			$( ".showForLoggedInUsers" ).addClass( "hidden" );
			return;
		}

		const snapshot = await firebase.firestore().collection('TroffData').get()
		const docs = snapshot.docs;
		const allTroffData = docs.map(doc => doc.data());



		let fileList = [];

		let totalSize = 0;

		for( const troffData of allTroffData ) {
			const fileUrl = troffData.fileUrl.substring(0, troffData.fileUrl.indexOf('?'))

			let miniTroffData = {
				id : troffData.id,
				markerJsonString : troffData.markerJsonString,
			}

			let currentFile = fileList.find( x => x.fileUrl == fileUrl );


			if( currentFile == undefined ) {

				const fileData = await fetch( fileUrl )
					.then(res => res.json());

				let deleted = false;
				if( fileData.error && fileData.error.code == 404 ) {
					deleted = true;
				}

				let file = {
					fileName : troffData.fileName,
					fileUrl : fileUrl,
					fileType : troffData.fileType,
					fileSize : troffData.fileSize,
					deleted : deleted,
					updated : deleted ? "" : fileData.updated,
					fullFileName : deleted ? "" : fileData.name,
					troffData : [ miniTroffData ]
				}
				if( !deleted ) {
					totalSize += troffData.fileSize;
				}

				fileList.push( file );
			} else {
				currentFile.troffData.push( miniTroffData );
			}

		};

		$( ".totalSize" ).text( st.byteToDisp( totalSize ) );

		// sorting largest first:
		fileList.sort( ( a, b ) => (a.fileSize < b.fileSize) ? 1 : -1 );


		$.each( fileList, ( i, file ) => {

			let newDiv = $("#template").children().clone();
			if( file.deleted ) {
				newDiv
					.addClass( "grayOut" )
					.removeClass( "bg-Burlywood" );
				newDiv.find( ".removeFile" ).addClass( "hidden" )
				newDiv.find( ".removedText" ).removeClass( "hidden" )
			}
			newDiv.find( ".fileName" ).text( file.fileName ).attr( "href", file.fileUrl );
			newDiv.find( ".fileType" ).text( file.fileType );
			newDiv.find( ".updated" ).text( file.deleted ? "" : file.updated.substr( 0, 10 ) );
			newDiv.find( ".fileSize" ).text( st.byteToDisp( file.fileSize ) );
			newDiv.find( ".troffData" ).text( file.troffData.length );
			$( "#fileList" ).append( newDiv );

			newDiv.find( ".removeFile" ).on( "click", () => {

				// Create a reference to the file to delete
        const desertRef = storageRef.child( file.fullFileName );

        // Delete the file
        desertRef.delete().then( () => {
        	newDiv
        		.addClass( "grayOut" )
        		.removeClass( "bg-Burlywood" );
        	newDiv.find( ".removeFile" ).addClass( "hidden" )
        	newDiv.find( ".removedText" ).removeClass( "hidden" )
        }).catch( ( error ) => {
					$( "#alertDialog" ).removeClass( "hidden" );
					$( "#alertHeader" ).text( "Error" );
					$( "#alertText" ).text( "Could not remove: " + error );
        	console.error( error );
        });

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



})


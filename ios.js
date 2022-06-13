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
	console.log( "ios.js -> 2022-06-13 12:10" );

	/************************************************
	/*           Private methods and variables:
	/************************************************/
	const v3Init = { "status" : 200, "statusText" : "version-3", "responseType" : "cors" };

	//const app = firebase.initializeApp(environment.firebaseConfig);
  //const storage = firebase.storage();
  //const storageRef = storage.ref();

	const saveResponse = async function( response, url ) {
		console.log( "ios.js saveResponse ->");
		return caches.open( nameOfCache ).then( cache => {
			console.log( "ios.js saveResponse: caches.open ->");
			return cache.put( url, response );
		});
	};
	const fetchAndGetResponse = async function( fileUrl, songKey ) {
		console.log( "ios.js fetchAndGetResponse -> fileUrl " + fileUrl + "songKey " + songKey );
		const response = await fetch( fileUrl );
		console.log( "ios.js fetchAndGetResponse: fetched url" );
		if( !response.ok ) {
			console.log( "ios.js fetchAndGetResponse: response NOT OK" );
			throw response;
		}
		console.log( "ios.js fetchAndGetResponse: response ok" );
		const contentLength = +response.headers.get('Content-Length');
		const reader = response.body.getReader();
		let receivedLength = 0; // received that many bytes at the moment
		let chunks = []; // array of received binary chunks (comprises the body)
		while(true) {
      const {done, value} = await reader.read();

      if (done) {
        break;
      }
			chunks.push(value);
			receivedLength += value.length;

			if( typeof firebaseWrapper.onDownloadProgressUpdate == "function" ) {
				const progress = (receivedLength / contentLength) * 100;
				firebaseWrapper.onDownloadProgressUpdate( Math.floor( progress ) );
			}
    }
		const blob = new Blob(chunks);
		console.log( "ios.js fetchAndGetResponse: blob", blob );
		return saveResponse( new Response( blob, v3Init ), "horse.mp3" );
//		return blob;
	};




	const nameOfCache = "testSongCache-v1.0";
	let horseTroffDataId = 3858206134;
	let horseFileName = "A Horse.mp3"


	let fileUrl = "https://firebasestorage.googleapis.com/v0/b/troff-test.appspot.com/o/TroffFiles%2F07eb3c97415b69f12fd8816678946a94ca1a7c1a638739241fc08c701a14437e?alt=media&token=72bebc3d-da10-4b1c-9db7-c61ce712d278"
//	let troffData = await backendService.getTroffData( horseTroffDataId, horseFileName );
	console.log( "ios.js A" );



	$( "#player2" ).attr( "src", fileUrl );

	console.log( "ios.js B" );
	let response =  await fetchAndGetResponse( fileUrl );
	console.log( "ios.js C Have fetched and saved Response as horse.mp3" );
	//console.log( "fetchAndGetResponse( fileUrl )", response );

	$( "#player3" ).attr( "src", "horse.mp3" );
	console.log( "ios.js D have set src to horse.mp3" );
	console.log( "ios.js Good luck!" );

//	$( "#player3" ).attr( "src",  );




});




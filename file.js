const fileHandler = {};

$(function () {
	"use strict";


	/************************************************
	/*           Private methods and variables:
	/************************************************/

	const nameOfCache = "songCache-v1.0";

	/************************************************
	/*           Public methods:
	/************************************************/

	fileHandler.saveFile = async function( file, callbackFunk ) {
		const url = file.name;

		return caches.open( nameOfCache ).then( cache => {
			let init = { "status" : 200 , "statusText" : "version-3" };
			return cache.put(url, new Response( file, init ) ).then( () => {
				callbackFunk( url );
			});
		});
	};

	fileHandler.getObjectUrlFromFile = async function( songKey ) {
		return caches.match( songKey ).then(cachedResponse => {
			if (cachedResponse === undefined) {
				throw new Error(`songKey "${songKey}" does not exist in caches!`);
			}
			return cachedResponse.blob().then( URL.createObjectURL );
		});
	};

	fileHandler.removeFile = async function( url ) {
		//TODO: implement removeFile :)
		console.info( "fileHandler.removeFile is not yet implemented :( " );
	};

	fileHandler.sendFile = async function( url, file ) {

		$.ajax({
			url: url,
			type: 'POST',
			data: fileToFormData( file ),
			contentType: false,
			processData: false,
			success: function(response){
				console.log( "success", response );
			},
			error: function( err ) {
				console.log( "err", err );
			}
		});

	};

	fileHandler.handleFiles = async function( files, callbackFunk ) {
		console.log( "files", files);
		let i = 0;


		// Loop through the FileList and render the files as appropriate.
		for ( let f; f = files[ i ]; i++) {

			// Only process image, audio and video files.
			if( !(f.type.match('image.*') || f.type.match('audio.*') || f.type.match('video.*')) ) {
				console.error("handleFileSelect2: unrecognized type! f: ", f);
				continue;
			}

			try {
				fileHandler.saveFile( f, callbackFunk );
			} catch( exception ) {
				console.log( "exception", exception)
			}

		}

	};

});


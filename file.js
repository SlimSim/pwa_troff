const fileHandler = {};
const backendService = {};

$(function () {
	"use strict";


	/************************************************
	/*           Private methods and variables:
	/************************************************/

	const nameOfCache = "songCache-v1.0";

	const readFileTypeAndExtension = function( file, callbackFunk ) {
		var reader = new FileReader();
		reader.addEventListener( "load", function(e) {

			const arr = (new Uint8Array(e.target.result)).subarray(0, 22);
			let extension = "",
				type = "",
				h = "";

			for(var i = 0; i < arr.length; i++) {
				h += arr[i].toString(16).toUpperCase();
			}

			if( h.startsWith( "494433" ) || h.startsWith( "FFFB" ) || h.startsWith( "FFF3" ) || h.startsWith( "FFF2" ) ) {
				[type, extension] = ["audio/mpeg", "mp3"];
			} else if( h.startsWith( "00020667479704D3441" ) ) {
				[type, extension] = ["audio/x-m4a", "m4a"];
			} else if( h.startsWith( "52494646" ) && h.indexOf( "57415645" ) != -1 ) {
				[type, extension] = ["audio/wav", "wav"];
			} else if( h.startsWith( "4F676753" ) ) {
				[type, extension] = ["audio/ogg", "ogg"];
			} else if( h.startsWith( "52494646" ) && h.indexOf( "41564920" ) != -1 ) {
				[type, extension] = ["video/x-msvideo", "avi"];
			} else if( h.startsWith( "464C56" ) ) {
				[type, extension] = ["video/x-flv", "flv"];
			} else if( h.indexOf( "667479703367" ) != -1 ) {
				[type, extension] = ["video/3gpp", "3gp"];
			} else if( h.indexOf( "46674797" ) != -1 ) {
				[type, extension] = ["video/quicktime", "mov"];
			} else if( h.startsWith( "47" ) || h.startsWith( "001BA" ) || h.startsWith( "001B3" ) ) {
				[type, extension] = ["video/mpeg", "mpeg"];
			} else if( h.indexOf( "6674797069736F6D" ) != -1 ) {
				[type, extension] = ["video/mp4", "mp4"];
			} else if( h.startsWith( "1A45DFA3" ) ) {
				[type, extension] = ["video/webm", "webm"];
			} else if( h.startsWith( "3026B2758E66CF11" ) || h.startsWith( "A6D900AA0062CE6C" ) ) {
				[type, extension] = ["video/x-ms-wmv", "wmv"];
			} else if( h.startsWith( "89504E47" ) ) {
				[type, extension] = ["image/png", "png"];
			} else if( h.startsWith( "52494646" ) && h.indexOf( "57454250" ) != -1  ) {
				[type, extension] = ["image/webp", "webp"];
			} else if( h.startsWith( "FFD8FF" ) ) {
				[type, extension] = ["image/jpeg", "jpeg"];
			} else if( h.startsWith( "474946383761" ) || h.startsWith( "474946383961" ) ) {
				[type, extension] = ["image/gif", "gif"];
			} else if( h.startsWith( "424D" ) ) {
				[type, extension] = ["image/bmp", "bmp"];
			}

			const renamedFile = new File([file], file.name + "." + extension, {type: type});
			callbackFunk( renamedFile );
		});
		reader.readAsArrayBuffer( file );
	};

	const handleFileWithFileType = function( file, callbackFunk ) {
		// Only process image, audio and video files.
		if( !(file.type.match('image.*') || file.type.match('audio.*') || file.type.match('video.*')) ) {
			console.error( "handleFileWithFileType: unrecognized type! file: ", file );
			return;
		}

		try {
			fileHandler.saveFile( file, callbackFunk );
		} catch( exception ) {
			console.error( "Exception in fileHandler.saveFile, file and exception:", file, exception );
		}
	}

	/************************************************
	/*           Public methods:
	/************************************************/

	backendService.calCurl = async function() {
		const url = environment.getCurlEndpoint();
		$.ajax({
			url: url,
			timeout: 60000,
		}).fail(function( xhr ) {
			console.info( `backendService.calCurl: Could not cal "${url}", no big deal. Status: ${xhr.status}, ${xhr.statusText}` );
		});
	};

	backendService.getTroffData = async function( troffDataId, fileName ) {
		const url = environment.getTroffDataEndpoint(troffDataId, fileName);

		return $.ajax({
			url: url,
			timeout: 50000,
		})
		.then( async function(response) {
			if( response.status != "OK" ) {
				throw response;
			}
			return response.payload;
		});
	};

	fileHandler.fetchAndSaveResponse = async function( fileId, songKey ) {
		const url = environment.getDownloadFileEndpoint( fileId );
		return await fetch( url )
			.then( (response) => {
			 if( !response.ok ) {
				throw response;
			 }
			 return fileHandler.saveResponse( response, songKey );
			});
	};

//private?
	fileHandler.saveResponse = async function( response, url ) {
		return caches.open( nameOfCache ).then( cache => {
			return cache.put(url, response );
		});
	};

//private?
	fileHandler.saveFile = async function( file, callbackFunk ) {
			const url = file.name;
			let init = { "status" : 200 , "statusText" : "version-3", "responseType" : "cors"};
			return fileHandler.saveResponse( new Response( file, init ), url ).then( () => {
					callbackFunk( url );
			} );

	};

//private?
	fileHandler.getObjectUrlFromResponse = async function( response, songKey ) {

		if (response === undefined) {
			throw new ShowUserException(`Can not upload the song "${songKey}" because it appears to not exist in the app.
				 Please add the song to Troff and try to upload it again.` );
		}
		return response.blob().then( URL.createObjectURL );
	}

	fileHandler.getObjectUrlFromFile = async function( songKey ) {
		return caches.match( songKey ).then(cachedResponse => {
			return fileHandler.getObjectUrlFromResponse( cachedResponse, songKey );
		});
	};

	fileHandler.doesFileExistInCache = async function( url ) {
		let response = await caches.match( url );
		return response !== undefined;

	};

	fileHandler.sendFile = async function( fileKey, oSongTroffInfo ) {
		if( await cacheImplementation.isSongV2( fileKey ) ) {
			throw new ShowUserException(`Can not upload the song "${fileKey}" because it is saved in an old format,
            we apologize for the inconvenience.
            Please add the file "${fileKey}" to troff again,
            reload the page and try to upload it again` );
		}

		const strSongTroffInfo = JSON.stringify( oSongTroffInfo );

		return caches.match( fileKey ).then(cachedResponse => {
			if ( cachedResponse === undefined ) {
				throw new ShowUserException(`Can not upload the song "${fileKey}" because it appears to not exist in the app.
                Please add the song to Troff and try to upload it again.` );
			}

			return cachedResponse.blob().then( myBlob => {

				var file = new File(
					[myBlob],
					fileKey,
					{type: myBlob.type}
				);

				let formData = new FormData();
				formData.append( "file", file );
				formData.append( "songTroffInfo", strSongTroffInfo );

				const uploadFileEndpoint =  environment.getUploadFileEndpoint();

				return $.ajax({
					url: uploadFileEndpoint,
					type: 'POST',
					data: formData,
					contentType: false,
					processData: false,
				});

			});
    });
	};

	fileHandler.handleFiles = async function( files, callbackFunk ) {
		let i = 0;

		// Loop through the FileList and render the files as appropriate.
		for ( let file; file = files[ i ]; i++) {
			if( file.type == "" ) {

				readFileTypeAndExtension( file, function( fileWithType ) {
					handleFileWithFileType( fileWithType, callbackFunk );
				});
				continue;
			}
			handleFileWithFileType( file, callbackFunk );
		}
	};

});


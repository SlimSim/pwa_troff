const fileHandler = {};
const backendService = {};

$(function () {
	"use strict";


	/************************************************
	/*           Private methods and variables:
	/************************************************/

	const nrOfTriesToCallBackend = 3;

	const nameOfCache = "songCache-v1.0";

	const getTroffDataHelper = async function( troffDataId, fileName, nr ) {
		console.log( "getTroffDataHelper -> " + nr + " of " + nrOfTriesToCallBackend + " tries , " + fileName);
		const url = environment.getTroffDataEndpoint(troffDataId, fileName);

		try {
			return await $.ajax({
				url: url,
				timeout: 60000,
			})
			.then(async function(response) {
				if( response.status != "OK" ) {
					console.error( "getTroffDataHelper, response is NOT ok, url = " + url + ", nr = " + nr, response );
					if( nr >= nrOfTriesToCallBackend ) {
						throw response;
					} else {
						return await getTroffDataHelper( troffDataId, fileName, nr+1 );
					}
				}
				return response.payload;
			});
		} catch(XMLHttpRequest) {
			if (XMLHttpRequest.readyState == 4) {
				console.error( "getTroffDataHelper: HTTP error url = " + url + ", nr = " + nr, XMLHttpRequest );
				// HTTP error (can be checked by XMLHttpRequest.status and XMLHttpRequest.statusText)
			}
			else if (XMLHttpRequest.readyState == 0) {
				console.error( "getTroffDataHelper: Network error (i.e. connection refused, access denied due to CORS, etc.) url = " + url + ", nr = " + nr, XMLHttpRequest );
			}
			else {
				console.error( "getTroffDataHelper: Something weird is happening: url = " + url + ", nr = " + nr, XMLHttpRequest );
			}

			if( nr >= nrOfTriesToCallBackend ) {
				throw XMLHttpRequest;
			} else {
				return await getTroffDataHelper( troffDataId, fileName, nr+1 );
			}
		}
	};


	const fetchAndSaveResponseHelper = async function( fileId, songKey, nr ) {
		console.log( "fetchAndSaveResponseHelper -> " + nr + " of " + nrOfTriesToCallBackend + " tries, " + songKey);
		const url = environment.getDownloadFileEndpoint( fileId );
			return await fetch( url )
			.then( async (response) => {
				if( !response.ok ) {
					console.error( "fetchAndSaveResponseHelper, response is NOT ok, url = " + url + ", nr = " + nr, response );
					if( nr >= nrOfTriesToCallBackend ) {
						throw response;
					} else {
						return await fetchAndSaveResponseHelper( fileId, songKey, nr+1 );
					}
				}
				return fileHandler.saveResponse( response, songKey );
			})
			.catch(async function( e ) {
				console.error( "fetchAndSaveResponseHelper, catch! url = " + url + ", nr = " + nr, e );
				if( nr >= nrOfTriesToCallBackend ) {
					throw e;
				} else {
					return await fetchAndSaveResponseHelper( fileId, songKey, nr+1 );
				}
			});
	};

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
		return await getTroffDataHelper( troffDataId, fileName, 1 );
	};

	fileHandler.fetchAndSaveResponse = async function( fileId, songKey ) {
		return await fetchAndSaveResponseHelper( fileId, songKey, 1 );
	};

	fileHandler.saveResponse = async function( response, url ) {
		return caches.open( nameOfCache ).then( cache => {
			return cache.put(url, response );
		});
	};


    fileHandler.saveFile = async function( file, callbackFunk ) {
        const url = file.name;
        let init = { "status" : 200 , "statusText" : "version-3", "responseType" : "cors"};
        return fileHandler.saveResponse( new Response( file, init ), url ).then( () => {
            callbackFunk( url );
        } );

    };

    /*
	fileHandler.saveFile_old_and_working = async function( file, callbackFunk ) {
		const url = file.name;

		//TODO: Denna borde kunna använda sig av saveResponse, om jag kör en:
		//TODO: return fileHandler.saveResponse( new Response( file, init ), url ).then( () => {callbackFunk( url ) });
		return caches.open( nameOfCache ).then( cache => {
			let init = { "status" : 200 , "statusText" : "version-3", "responseType" : "cors"};
			return cache.put(url, new Response( file, init ) ).then( () => {
				callbackFunk( url );
			});
		});
	};
	*/

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


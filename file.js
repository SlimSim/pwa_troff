const fileHandler = {};
const backendService = {};

$(function () {
	"use strict";


	/************************************************
	/*           Private methods and variables:
	/************************************************/

	const nameOfCache = "songCache-v1.0";

	const getTroffDataHelper = async function( troffDataId, fileName, nr ) {
		console.log( "getTroffDataHelper -> " + nr);
		const url = environment.getTroffDataEndpoint(troffDataId, fileName);

		return $.ajax({
			url: url,
			timeout: 60000,
		})
		.then(async function(response) {
			if( response.status != "OK" ) {
				console.error( "getTroffDataHelper, response is NOT ok, url = " + url + ", nr = " + nr );
				console.error( response );
				if( nr <= 0 ) {
					throw response;
				} else {
					return getTroffDataHelper( troffDataId, fileName, nr-1 );
				}
			}
			return response.payload;
		})
		.fail(function(xhr, status, error) {
				console.error( "fetchAndSaveResponseHelper, catch! url = " + url + ", nr = " + nr );
				console.error( xhr );
				console.error( status );
				console.error( error );

				if( nr <= 0 ) {
					throw error;
				} else {
					return getTroffDataHelper( troffDataId, fileName, nr-1 );
				}
		});
	};


	const fetchAndSaveResponseHelper = async function( fileId, songKey, nr ) {
		console.log( "fetchAndSaveResponseHelper -> " + nr);
		const url = environment.getDownloadFileEndpoint( fileId );
		return fetch( url )
			.then( (response) => {
				if( !response.ok ) {
					console.error( "fetchAndSaveResponseHelper, response is NOT ok, url = " + url + ", nr = " + nr );
					console.error( response );
					if( nr <= 0 ) {
						throw response;
					} else {
						return fetchAndSaveResponseHelper( troffDataId, fileName, nr-1 );
					}
				}
				return fileHandler.saveResponse( response, songKey );
			})
			.catch(function( e ) {
				console.error( "fetchAndSaveResponseHelper, catch! url = " + url + ", nr = " + nr );
				console.error( e );
				if( nr <= 0 ) {
					throw e;
				} else {
					return fetchAndSaveResponseHelper( troffDataId, fileName, nr-1 );
				}
			});
	};

	/************************************************
	/*           Public methods:
	/************************************************/

	backendService.calCurl = async function() {
		const url = environment.getCurlEndpoint();
		$.ajax({
			url: url,
			timeout: 60000,
		}).fail(function( xhr ) {
			console.log( `backendService.calCurl: Could not cal "${url}", no big deal. Status: ${xhr.status}, ${xhr.statusText}` );
		});
	};

	backendService.getTroffData = async function( troffDataId, fileName ) {
		console.log( "backendService.getTroffData -> ");
		return getTroffDataHelper( troffDataId, fileName, 3 );
	};

	fileHandler.fetchAndSaveResponse = async function( fileId, songKey ) {
		return fetchAndSaveResponseHelper( fileId, songKey, 3 );
	};

/*
	fileHandler.dev_fetchAndSaveResponse = function() {
		/*
			* Denna fungerar, den laddar låten till cachen och man kan spela den sen!
			* möjliga nackdelar:
			* 1) den sparar det som "Response-Type" cors istället för "default"
			* 2) den säger att "Content-Length" är 14,592 istället för "0"
			*
			* kommer detta bli problem då om den kommer räkna låtarna som att dom tar platts?
			*  - å andra sidan kanske det är snällt mot användarna att faktiskt visa vad som tar plats?
			*  - och ge dom möjlighet att ta bort låtar (måste bara kolla att man kan lägga till timmars musik!


			* kan jag på något sätt ställa in vad den ska spara filen för response-type som?

			* eller så bryr jag mig inte om den skillnaden ??? (what could possibly go wrong?)
			* om man kollar under Application-tabben, uner storage, så står det Cache Storage där,
			* och den tickar upp när man lägger till filer från hårddisken, alltså låtar som får content-length: 0
			* men borde testa hur mycket jag kan cacha långa låtar från servern!

			kram

			(och sen så måste jag ju givetvis fixa så att den hämtar meta-datat också, och fixar rätt songKey till låten mm!)
			(what to do if dom krockar????)
			jaja, vi tar det när det kommer :D
		* /


		/*
			så, jag vill använda denna,
			MEN, först ska jag hämta troff_data och metadata från backend, och där får jag bland annat
			en songKey och downloadUrl att köra denna funktion med!
			Sen så är det bara att dunka in troff_datan, sparad med samma songKey, och sen ladda låten
			helt enkelt bara köra createSongAudio( songKey )! :)
		* /
		let songKey = "Hozier - Take Me To Church.mp3"; // <--- note man måste tydligen ha med .mp3.... :)
		fetch('http://localhost:8080/ternsjo_Troff/downloadFile/3')
			.then( (response) => {
				console.log( "response", response );
				fileHandler.saveResponse( response, songKey, console.log );

				//$("#audio1").attr( "src", response.body );
			})
			.catch(() => alert('oh no!'));
	};
	*/

	/*
	fileHandler.dev_fetchAndLoad = function() {
		/* ANVÄND EJ!!!
			Denna fungerar säkert, men använd dev_fetchAndSaveResponse istället!
			* /
		fetch("http://localhost:8080/ternsjo_Troff/downloadFile/2")
    .then(resp => {
        console.log( "1an" );
        console.log( resp );
        fileHandler.getObjectUrlFromResponse( resp ).then( objectUrl => {
            console.log( "objectUrl", objectUrl);
            setSong2( "song6.mp3", "audio", objectUrl )
        });
    })

	};
	*/
	/*
	fileHandler.saveResponse_1 = async function( response, url, callbackFunk ) {

		return caches.open( nameOfCache ).then( cache => {
			return cache.put(url, response ).then( ( putResp ) => {
				console.log( "putResp", putResp );
				callbackFunk( url );
			});
		});
	};
	*/


	fileHandler.saveResponse = async function( response, url ) {
		return caches.open( nameOfCache ).then( cache => {
			return cache.put(url, response );
		});
	};


	fileHandler.saveFile = async function( file, callbackFunk ) {
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

	fileHandler.removeFile = async function( url ) {
		//TODO: implement removeFile :)
		console.info( "fileHandler.removeFile is not yet implemented :( " );
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

	/*
	fileHandler.sendFile_funkar_saftey = async function( uploadFileEndpoint, fileKey, oSongTroffInfo ) {
		if( await cacheImplementation.isSongV2( fileKey ) ) {
			throw new Error(`fileKey "${fileKey}" is version 2, unable to upload!`);
		}

		const strSongTroffInfo = JSON.stringify( oSongTroffInfo );

		caches.match( fileKey ).then(cachedResponse => {
			if ( cachedResponse === undefined ) {
				throw new Error(`fileKey "${fileKey}" does not exist in caches!`);
			}

			console.log( "cachedResponse", cachedResponse );

			cachedResponse.blob().then( myBlob => {
				// TODO: lastModified (and possibly other meta-data)
				// from the file somehow. Should possibly save that data in the local-storage
				// when I first add the file?

				console.log( "songTroffInfo", oSongTroffInfo );
				console.log( "myBlob", myBlob );

				for(var key of cachedResponse.headers.keys()) {
					 console.log(key);
				}

				var file = new File(
					[myBlob],
					fileKey,
					{type: myBlob.type}
				);

				let formData = new FormData();
				formData.append( "file", file );
				formData.append( "songTroffInfo", strSongTroffInfo );

				console.log( "sendFile: uploadFileEndpoint", uploadFileEndpoint);


				$.ajax({
					url: uploadFileEndpoint,
					type: 'POST',
					data: formData,
					contentType: false,
					processData: false,
					success: function( response ) {
						console.log( "sendFile success:", response);
						//todo: update the searchPath in the cache to the files new url?
					},
					error: function( err ) {
						console.error( "fileHandler.sendFile, POST to " + uploadFileEndpoint + " gives error", err );
					}
				});

			});
		});
	};
	*/

	fileHandler.handleFiles = async function( files, callbackFunk ) {
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
				console.error( "exception", exception)
			}
		}
	};

});


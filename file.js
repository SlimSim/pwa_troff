const fileHandler = {};
const backendService = {};
const firebaseWrapper = {};

$(function () {
	"use strict";


	/************************************************
	/*           Private methods and variables:
	/************************************************/

	const nameOfCache = "songCache-v1.0";

	const crc32Hash = function(r){
		for(var a,o=[],c=0;c<256;c++){
			a=c;for(var f=0;f<8;f++)a=1&a?3988292384^a>>>1:a>>>1;o[c]=a
		}
		for(var n=-1,t=0;t<r.length;t++)n=n>>>8^o[255&(n^r.charCodeAt(t))];
		return(-1^n)>>>0;
	};

	const hashFile = async function( file ) {
		return new Promise((resolve, reject) => {
			let reader = new FileReader();
			reader.onload = async function (event) {
				const data = event.target.result;
				const fileHash = await sha256Hash( data );
				resolve( fileHash );
			};
			reader.onerror = reject;
			reader.readAsBinaryString(file);
		});
	}

	const sha256Hash = async function( object ) {
		const msgUint8 = new TextEncoder().encode( JSON.stringify(  object ) );
		const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		return hashHex;
	}

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

	backendService.getTroffData = async function( troffDataId, fileName ) {

		const db = firebase.firestore();
		const troffDataReference = db.collection( 'TroffData' ).doc( troffDataId );

		return troffDataReference.get().then( doc => {
			return doc.data();
		});
	};

	fileHandler.fetchAndSaveResponse = async function( fileUrl, songKey ) {
		return await fetch( fileUrl )
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

			return cachedResponse.blob().then( async myBlob => {

				var file = new File(
					[myBlob],
					fileKey,
					{type: myBlob.type}
				);

        let fileHash = await hashFile( file );

				const fileUrl = await firebaseWrapper.uploadFile( fileHash, file );

				const troffData = {
					//id: - to be added after hashing
					fileName: file.name,
					fileType: file.type,
					fileSize: file.size,
					fileUrl: fileUrl,
					markerJsonString: strSongTroffInfo
				};

        troffData.id = crc32Hash( JSON.stringify( troffData ) );

				return firebaseWrapper.uploadTroffData( troffData ).then( retVal => {
					return {
						id: troffData.id,
						fileName: troffData.fileName
						//fileType: troffData.fileType,
						//fileSize: troffData.fileSize,
						//fileId: troffData.fileId,
						//markerJsonString: troffData.markerJsonString
					};
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

	firebaseWrapper.uploadFile = async function( fileId, file ) {

    const storageRef = firebase.storage().ref( "TroffFiles" );
    const fileRef = storageRef.child( fileId );
    const task = fileRef.put( file );
    const fileName = file.name;

		return new Promise((resolve, reject) => {

			task.on('state_changed',
				(snapshot) => {
					// Observe state change events such as progress, pause, and resume
					// Get task progress, including the number of bytes uploaded
					// and the total number of bytes to be uploaded
					var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
					console.log("firebase.uploadFile: " + fileName + ' upload is ' + progress + '% done');
					switch (snapshot.state) {
						case firebase.storage.TaskState.PAUSED: // or 'paused'
							console.log('firebase.uploadFile: Upload is paused');
							break;
						case firebase.storage.TaskState.RUNNING: // or 'running'
							//console.log('firebase.uploadFile: Upload is running');
							break;
					}
				},
				(error) => {
					// Handle unsuccessful uploads
					console.error( error );
					reject( error );
				},
				() => {
					task.snapshot.ref.getDownloadURL().then((downloadURL) => {
						resolve( downloadURL );
					});
				}
			);
		});

	};

	firebaseWrapper.uploadTroffData = function( troffData ) {

		const db = firebase.firestore();

		return db.collection( "TroffData" ).doc( String( troffData.id ) ).set(troffData)
			.then( ( x ) => {
				return troffData;
			})
			.catch(console.error);

	};

	// Initialize Firebase:
	const app = firebase.initializeApp(environment.firebaseConfig);
	//const analytics = getAnalytics(app);

});



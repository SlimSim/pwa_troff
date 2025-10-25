/* eslint eqeqeq: "off" */

const fileHandler = {} as TroffFileHandler;
const backendService = {} as BackendService;
const firebaseWrapper = {} as FirebaseWrapper;

import { ShowUserException } from '../scriptErrorHandler.js';
import {
  db,
  getDoc,
  doc,
  setDoc,
  storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from './firebaseClient.js';
import { IO } from '../script.js';
import log from '../utils/log.js';
import { cacheImplementation } from './FileApiImplementation.js';
import { TroffFileHandler } from 'types/file.js';
import { FirebaseWrapper } from 'types/firebase.js';
import { BackendService, TroffData } from 'types/troff.js';
import { StorageReference } from 'firebase/storage';

$(() => {
  'use strict';

  /************************************************
	/*           Private methods and variables:
	/************************************************/

  const nameOfCache = 'songCache-v1.0';

  const v3Init = { status: 200, statusText: 'version-3', responseType: 'cors' };

  const crc32Hash = (r: string): number => {
    for (var a, o = [], c = 0; c < 256; c++) {
      a = c;
      for (var f = 0; f < 8; f++) a = 1 & a ? 3988292384 ^ (a >>> 1) : a >>> 1;
      o[c] = a;
    }
    for (var n = -1, t = 0; t < r.length; t++) n = (n >>> 8) ^ o[255 & (n ^ r.charCodeAt(t))];
    return (-1 ^ n) >>> 0;
  };

  const hashFile = async (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event || !event.target) return;
        const data = event.target.result;
        const fileHash = await sha256Hash(data);
        resolve(fileHash);
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  const sha256Hash = async (object: any) => {
    const msgUint8 = new TextEncoder().encode(JSON.stringify(object));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const readFileTypeAndExtension = (
    file: File,
    callbackFunk: { (fileWithType: any): void; (arg0: File): void }
  ) => {
    var reader = new FileReader();
    reader.addEventListener('load', (e) => {
      if (!e || !e.target) return;
      const arr = new Uint8Array(e.target.result as ArrayBuffer).subarray(0, 22);
      let extension = '',
        type = '',
        h = '';

      for (var i = 0; i < arr.length; i++) {
        h += arr[i].toString(16).toUpperCase();
      }

      if (
        h.startsWith('494433') ||
        h.startsWith('FFFB') ||
        h.startsWith('FFF3') ||
        h.startsWith('FFF2')
      ) {
        [type, extension] = ['audio/mpeg', 'mp3'];
      } else if (h.startsWith('00020667479704D3441')) {
        [type, extension] = ['audio/x-m4a', 'm4a'];
      } else if (h.startsWith('52494646') && h.indexOf('57415645') != -1) {
        [type, extension] = ['audio/wav', 'wav'];
      } else if (h.startsWith('4F676753')) {
        [type, extension] = ['audio/ogg', 'ogg'];
      } else if (h.startsWith('52494646') && h.indexOf('41564920') != -1) {
        [type, extension] = ['video/x-msvideo', 'avi'];
      } else if (h.startsWith('464C56')) {
        [type, extension] = ['video/x-flv', 'flv'];
      } else if (h.indexOf('667479703367') != -1) {
        [type, extension] = ['video/3gpp', '3gp'];
      } else if (h.indexOf('46674797') != -1) {
        [type, extension] = ['video/quicktime', 'mov'];
      } else if (h.startsWith('47') || h.startsWith('001BA') || h.startsWith('001B3')) {
        [type, extension] = ['video/mpeg', 'mpeg'];
      } else if (h.indexOf('6674797069736F6D') != -1) {
        [type, extension] = ['video/mp4', 'mp4'];
      } else if (h.startsWith('1A45DFA3')) {
        [type, extension] = ['video/webm', 'webm'];
      } else if (h.startsWith('3026B2758E66CF11') || h.startsWith('A6D900AA0062CE6C')) {
        [type, extension] = ['video/x-ms-wmv', 'wmv'];
      } else if (h.startsWith('89504E47')) {
        [type, extension] = ['image/png', 'png'];
      } else if (h.startsWith('52494646') && h.indexOf('57454250') != -1) {
        [type, extension] = ['image/webp', 'webp'];
      } else if (h.startsWith('FFD8FF')) {
        [type, extension] = ['image/jpeg', 'jpeg'];
      } else if (h.startsWith('474946383761') || h.startsWith('474946383961')) {
        [type, extension] = ['image/gif', 'gif'];
      } else if (h.startsWith('424D')) {
        [type, extension] = ['image/bmp', 'bmp'];
      }

      const renamedFile = new File([file], file.name + '.' + extension, {
        type: type,
      });
      callbackFunk(renamedFile);
    });
    reader.readAsArrayBuffer(file);
  };

  const handleFileWithFileType = (file: File, callbackFunk: (url: string, file: File) => void) => {
    // Only process image, audio and video files.
    if (!(file.type.match('image.*') || file.type.match('audio.*') || file.type.match('video.*'))) {
      IO.alert(
        'Unrecognized file',
        'Troff only supports audios, videos and images, ' +
          'this file seems to be a <br /><br />' +
          file.type +
          '<br /><br />If this file is an audio-, video- or image-file, ' +
          'we are deeply sorry, please contact us and describe your problem<br /><br />' +
          'Happy training!'
      );
      log.e('handleFileWithFileType: unrecognized type! file: ', file);
      return;
    }

    try {
      fileHandler.saveFile(file, callbackFunk);
    } catch (exception) {
      log.e('Exception in fileHandler.saveFile, file and exception:', file, exception);
    }
  };

  /************************************************
	/*           Public methods:
	/************************************************/

  backendService.getTroffData = async (troffDataId, fileName) => {
    const troffDocRef = doc(db, 'TroffData', troffDataId);
    const snapshot = await getDoc(troffDocRef);
    if (!snapshot.exists()) {
      throw new ShowUserException(
        `Could not find song "${fileName}", with id "${troffDataId}", on the server,
          perhaps the URL is wrong or the song has been removed`,
        'warning'
      );
    }
    return snapshot.data();
  };

  fileHandler.fetchAndSaveResponse = async (fileUrl, songKey) => {
    const response = await fetch(fileUrl);
    if (!response.ok || response.body == null || response.headers == null) {
      log.e('fileHandler.fetchAndSaveResponse fetch failed', {
        songKey,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Fetch failed for ${songKey}: ${response.statusText}`);
    }
    const contentLength = Number(response.headers.get('Content-Length'));
    const headerContentType = response.headers.get('Content-Type');
    log.d(`headerContentType ${headerContentType}`);
    const contentType = headerContentType || 'application/octet-stream';
    log.d(` contentLength: ${contentLength}, contentType: ${contentType}`);
    const reader = response.body.getReader();
    let receivedLength = 0; // received that many bytes at the moment
    const chunks = []; // array of received binary chunks (comprises the body)
    log.d('fileHandler.fetchAndSaveResponse headers', {
      songKey,
      contentType,
      contentLength,
    });
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }
      chunks.push(value);
      receivedLength += value.length;

      if (typeof firebaseWrapper.onDownloadProgressUpdate == 'function') {
        const progress = (receivedLength / contentLength) * 100;
        firebaseWrapper.onDownloadProgressUpdate(Math.floor(progress));
      }
    }
    log.d('adding contentType to new Blob! lets hope this works!');
    const blob = new Blob(chunks, { type: contentType });
    log.d('fileHandler.fetchAndSaveResponse blob ready', {
      songKey,
      blobSize: blob.size,
      contentType: blob.type,
    });
    return fileHandler.saveResponse(new Response(blob, v3Init), songKey);
  };

  //private?
  fileHandler.saveResponse = async (response, url) => {
    return caches.open(nameOfCache).then((cache) => {
      return cache.put(url, response);
    });
  };

  //private?
  fileHandler.saveFile = async (file, callbackFunk) => {
    const url = file.name;
    return fileHandler.saveResponse(new Response(file, v3Init), url).then(() => {
      callbackFunk(url, file);
    });
  };

  //private?
  fileHandler.getObjectUrlFromResponse = async (response, songKey) => {
    if (response === undefined) {
      throw new ShowUserException(
        `Can not upload the song "${songKey}" because it appears to not exist in the app.
				 Please add the song to Troff and try to upload it again.`,
        'info'
      );
    }
    return response.blob().then(URL.createObjectURL);
  };

  fileHandler.getObjectUrlFromFile = async (songKey) => {
    return caches.match(songKey).then((cachedResponse) => {
      log.d('fileHandler.getObjectUrlFromFile cache match', {
        songKey,
        found: cachedResponse !== undefined,
        navigatorOnLine: navigator.onLine,
      });
      if (cachedResponse === undefined) {
        log.w('fileHandler.getObjectUrlFromFile cache miss', { songKey });
        throw new ShowUserException(`A problem occured with "${songKey}". Please try again.`);
      }
      return fileHandler.getObjectUrlFromResponse(cachedResponse, songKey);
    });
  };

  fileHandler.doesFileExistInCache = async (url) => {
    const response = await caches.match(url);
    return response !== undefined;
  };

  fileHandler.sendFileToFirebase = async (fileKey, storageDir) => {
    if (await cacheImplementation.isSongV2(fileKey)) {
      throw new ShowUserException(
        `Can not upload the song "${fileKey}" because it is saved in an old format,
			we apologize for the inconvenience.
			Please add the file "${fileKey}" to troff again,
			reload the page and try to upload it again`,
        'info'
      );
    }

    const cachedResponse = await caches.match(fileKey);
    if (cachedResponse === undefined) {
      throw new ShowUserException(
        `Can not upload the song "${fileKey}" because it appears to not exist in the app.
			Please add the song to Troff and try to upload it again.`,
        'info'
      );
    }

    const myBlob = await cachedResponse.blob();

    const file = new File([myBlob], fileKey, { type: myBlob.type });

    const fileHash = await hashFile(file);
    const fileUrl = await firebaseWrapper.uploadFile(fileHash, file, storageDir).catch((error) => {
      if (error instanceof ShowUserException) {
        throw error;
      }
    });
    if (!fileUrl) {
      throw new ShowUserException(
        `A problem occured with the song "${fileKey}". Please try to upload it again.`
      );
    }

    return [fileUrl, file];
  };

  /**
   * Sends both the file and the TroffData to Firebase
   * @param {string} fileKey
   * @param {TroffData-object} oSongTroffInfo
   * @param {string} storageDir
   * @returns {} object with troffData id, url and fileName
   */
  fileHandler.sendFile = async (fileKey, oSongTroffInfo, storageDir = 'TroffFiles') => {
    const [fileUrl, file] = await fileHandler.sendFileToFirebase(fileKey, storageDir);

    const strSongTroffInfo = JSON.stringify(oSongTroffInfo);
    const troffData: TroffData = {
      //id: - to be added after hashing
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileUrl: fileUrl,
      troffDataPublic: true,
      troffDataUploadedMillis: new Date().getTime(),
      markerJsonString: strSongTroffInfo,
    } as TroffData;

    troffData.id = crc32Hash(JSON.stringify(troffData));

    return firebaseWrapper.uploadTroffData(troffData).then(() => {
      return {
        id: troffData.id,
        fileUrl: troffData.fileUrl,
        fileName: troffData.fileName,
        //fileType: troffData.fileType,
        //fileSize: troffData.fileSize,
        //fileId: troffData.fileId,
        //markerJsonString: troffData.markerJsonString
      };
    });
  };

  fileHandler.handleFiles = async (files, callbackFunk) => {
    if (files == null) return;

    let i = 0;

    // Loop through the FileList and render the files as appropriate.
    for (let file; (file = files[i]); i++) {
      if (file.type == '') {
        readFileTypeAndExtension(file, (fileWithType) => {
          handleFileWithFileType(fileWithType, callbackFunk);
        });
        continue;
      }
      handleFileWithFileType(file, callbackFunk);
    }
  };

  const checkUploadedFileAndGetURL = async (fileRef: StorageReference) => {
    try {
      // 1) If it already exists, this succeeds immediately
      const existingUrl = await getDownloadURL(fileRef);
      return existingUrl;
    } catch (err: any) {
      if (err.code !== 'storage/object-not-found') {
        // Not a "missing object" case; surface the real error
        throw err;
      }
      log.i(
        'Ignore "404 (Not Found)"-error! It simply means that the song does not exist in Firebase, and will be uploaded now.'
      );
      return null;
    }
  };

  firebaseWrapper.uploadFile = async (fileId, file, storageDir = 'TroffFiles') => {
    const fileRef = ref(storage, `${storageDir}/${fileId}`);

    const existingUrl = await checkUploadedFileAndGetURL(fileRef);
    if (existingUrl) {
      return existingUrl;
    }

    const task = uploadBytesResumable(fileRef, file);
    return new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          if (typeof firebaseWrapper.onUploadProgressUpdate === 'function') {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            firebaseWrapper.onUploadProgressUpdate(Math.floor(progress));
          }
        },
        async (error) => {
          try {
            const downloadURL = await getDownloadURL(task.snapshot.ref);
            resolve(downloadURL);
          } catch {
            log.e('error:', error);
            reject(
              new ShowUserException(`Can not upload the file to the server.
              The server says: "${error.code}"`)
            );
          }
        },
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  };

  firebaseWrapper.uploadTroffData = async (troffData) => {
    try {
      await setDoc(doc(db, 'TroffData', String(troffData.id)), troffData);
      return troffData;
    } catch (error: any) {
      log.e('error: ', error);
      try {
        const troffDataInFirebase = await backendService.getTroffData(
          String(troffData.id),
          troffData.fileName
        );
        if (troffDataInFirebase) {
          return troffDataInFirebase;
        }
      } catch {
        // ignore and rethrow below
      }
      throw new ShowUserException(
        `Can not upload the markers and settings to the server.
								The server says: "${error.message}"`
      );
    }
  };
});

export { fileHandler, backendService, firebaseWrapper };

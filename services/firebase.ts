/* eslint eqeqeq: "off" */
// Firebase-related functions

import {
  db,
  collection,
  deleteDoc,
  doc,
  ref,
  storage,
  deleteObject,
  onSnapshot,
  setDoc,
  addDoc,
} from './firebaseClient.js';
import { fileHandler } from './file.js';
import { songDocUpdate } from '../script.js';
import { nDB } from '../assets/internal/db.js';
import log from '../utils/log.js';
import { SongToGroup } from '../scriptASimple.js';
import { fileUrlToStorageFileName, removeLocalInfo } from '../utils/utils.js';
import {
  TroffFirebaseGroupIdentifyer,
  TroffSongData,
  TroffSongIdentifyer,
} from '../types/troff.js';
import { TroffFileHandler } from 'types/file.js';

const removeSongFromFirebaseGroup = async function (
  songKey: string,
  groupDocId: string,
  songDocId: string
) {
  await removeSongDataFromFirebaseGroup(groupDocId, songDocId);

  const fileUrl = SongToGroup.songKeyToFileUrl(songKey, groupDocId, songDocId);

  if (!fileUrl) {
    return;
  }

  const storageFileName = fileUrlToStorageFileName(fileUrl);
  await removeSongFileFromFirebaseGroupStorage(groupDocId, storageFileName);
};

const removeSongDataFromFirebaseGroup = (groupDocId: string, songDocId: string) => {
  return deleteDoc(doc(db, 'Groups', groupDocId, 'Songs', songDocId));
};

const removeSongFileFromFirebaseGroupStorage = async (
  groupDocId: string,
  storageFileName: string
) => {
  const storageRef = ref(storage, `Groups/${groupDocId}/${storageFileName}`);
  try {
    await deleteObject(storageRef);
  } catch (error) {
    log.e(storageFileName + ' could not be deleted!', error);
    throw error;
  }
};

const pushSongWithLocalChanges = (groupDocId: string, songDocId: string, songKey: string) => {
  const changedSongList: TroffSongIdentifyer[] = nDB.get('TROFF_SONGS_WITH_LOCAL_CHANGES') || [];

  const songInGroupAlreadyExists = changedSongList.find(
    (o) => o.groupDocId == groupDocId && o.songDocId == songDocId && o.songKey == songKey
  );

  if (songInGroupAlreadyExists) {
    return;
  }

  changedSongList.push({
    groupDocId: groupDocId,
    songDocId: songDocId,
    songKey: songKey,
  });

  nDB.set('TROFF_SONGS_WITH_LOCAL_CHANGES', changedSongList);
};

const saveSongDataToFirebaseGroup = async function (
  songKey: string,
  groupDocId: string,
  songDocId: string
) {
  const publicData = removeLocalInfo(nDB.get(songKey));

  publicData.latestUploadToFirebase = Date.now();

  const songData: TroffSongData = {
    songKey: songKey,
    jsonDataInfo: JSON.stringify(publicData),
  };

  if (songDocId != undefined) {
    songData.fileUrl = SongToGroup.songKeyToFileUrl(songKey, groupDocId, songDocId);

    if (navigator.onLine) {
      await setDoc(doc(db, 'Groups', groupDocId, 'Songs', songDocId), songData);
    } else {
      $.notify('You are offline, your changes will be synced online once you come online!', {
        className: 'info',
        autoHide: false,
        clickToHide: true,
      });

      pushSongWithLocalChanges(groupDocId, songDocId, songKey);
    }
  } else {
    songData.fileUrl = await uploadSongToFirebaseGroup(groupDocId, songKey);

    // TODO! kolla att jag är online!
    //songData.latestUploadToFirebase = Date.now();

    const docRef = await addDoc(collection(db, 'Groups', groupDocId, 'Songs'), songData);

    SongToGroup.add(groupDocId, docRef.id, songKey, songData.fileUrl);

    onSnapshot(docRef, songDocUpdate);
    const songList: TroffFirebaseGroupIdentifyer = $('#songListList')
      .find(`[data-firebase-group-doc-id="${groupDocId}"]`)
      .data('songList');

    songList.songs.forEach((song) => {
      if (song.fullPath == songKey) {
        song.firebaseSongDocId = docRef.id;
      }
    });

    $('#songListList')
      .find(`[data-firebase-group-doc-id="${groupDocId}"]`)
      .data('songList', songList);
  }
};

const uploadSongToFirebaseGroup = async function (
  groupId: string,
  songKey: string
): Promise<string> {
  const [fileUrl] = await (fileHandler as TroffFileHandler).sendFileToFirebase(
    songKey,
    'Groups/' + groupId
  );
  return fileUrl as string;
};

export {
  removeSongDataFromFirebaseGroup,
  removeSongFromFirebaseGroup,
  saveSongDataToFirebaseGroup,
};

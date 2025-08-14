// Firebase-related functions

import {
  db,
  collection,
  query,
  where,
  getDocs,
} from "./services/firebaseClient.js";

async function initiateAllFirebaseGroups(firebaseUserEmail) {
  const q = query(
    collection(db, "Groups"),
    where("owners", "array-contains", firebaseUserEmail)
  );

  return await getDocs(q);
}

// TODO: bryta ut de externa funktionerna här och flytta denna funktion hit istället för i script?
// async function saveSongDataToFirebaseGroup(songKey, groupDocId, songDocId) {
//   const publicData = Troff.removeLocalInfo(nDB.get(songKey));
//   publicData.latestUploadToFirebase = Date.now();

//   const songData = {
//     songKey: songKey,
//     jsonDataInfo: JSON.stringify(publicData),
//   };

//   if (songDocId != undefined) {
//     songData.fileUrl = SongToGroup.songKeyToFileUrl(
//       songKey,
//       groupDocId,
//       songDocId
//     );

//     if (navigator.onLine) {
//   await setDoc(doc(db, "Groups", groupDocId, "Songs", songDocId), songData);
//     } else {
//       $.notify(
//         "You are offline, your changes will be synced online once you come online!",
//         {
//           className: "info",
//           autoHide: false,
//           clickToHide: true,
//         }
//       );

//       DB.pushSongWithLocalChanges(groupDocId, songDocId, songKey);
//     }
//   } else {
//     songData.fileUrl = await uploadSongToFirebaseGroup(groupDocId, songKey);

// const docRef = await addDoc(
//     collection(db, "Groups", groupDocId, "Songs"),
//     songData
// );

//     SongToGroup.add(groupDocId, docRef.id, songKey, songData.fileUrl);

//     onSnapshot(docRef, songDocUpdate);
//     const songList = $("#songListList")
//       .find(`[data-firebase-group-doc-id="${groupDocId}"]`)
//       .data("songList");

//     songList.songs.forEach((song) => {
//       if (song.fullPath == songKey) {
//         song.firebaseSongDocId = docRef.id;
//       }
//     });

//     $("#songListList")
//       .find(`[data-firebase-group-doc-id="${groupDocId}"]`)
//       .data("songList", songList);
//   }
// }

export { initiateAllFirebaseGroups };

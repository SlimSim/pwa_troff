// types/troff.d.ts
export interface TroffObjectLocal {
  TROFF_CLASS_TO_TOGGLE_buttStartBefore: boolean;
  TROFF_CLASS_TO_TOGGLE_buttStopAfter: boolean;
  TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops: boolean;
  TROFF_VALUE_incrementUntilValue: number | string;
  TROFF_VALUE_pauseBeforeStart: number | string;
  TROFF_VALUE_speedBar: number | string;
  TROFF_VALUE_startBefore: number | string;
  TROFF_VALUE_stopAfter: number | string;
  TROFF_VALUE_tapTempo: number | string;
  TROFF_VALUE_volumeBar: number;
  TROFF_VALUE_waitBetweenLoops: boolean;
  aStates: string[];
  abAreas: boolean[];
  currentStartMarker: string;
  currentStopMarker: string;
  fileData: TroffFileData;
  info: string;
  latestUploadToFirebase: number;
  localInformation: TroffLocalInformation;
  loopTimes: number | string;
  markers: TroffMarker[];
  zoomEndTime: number;
  zoomStartTime: number;
  serverId?: string;
  bPlayInFullscreen?: boolean;
  bMirrorImage?: boolean;
}

export type TroffObjectFirebase = Omit<TroffObjectLocal, 'localInformation'> & {
  localInformation?: never;
};

// todo: interface for State!
export interface State {
  buttPauseBefStart: boolean;
  buttStartBefore: boolean;
  buttStopAfter: boolean;
  buttWaitBetweenLoops: boolean;
  currentLoop: string;
  currentMarker: string;
  currentStopMarker: string;
  name: string;
  pauseBeforeStart: number | string;
  speedBar: number | string;
  startBefore: number | string;
  stopAfter: number | string;
  volumeBar: number | string;
  waitBetweenLoops: number | string;
}

export interface TroffLocalInformation {
  nrTimesLoaded: number;
}

export interface TroffFileData {
  album: string;
  artist: string;
  choreographer: string;
  choreography: string;
  customName: string;
  duration: number;
  genre: string;
  tags: string;
  title: string;
  lastModified?: number;
  size?: number;
}

export interface TroffMarker {
  color: string;
  id: string;
  info: string;
  name: string;
  time: number | string;
}

export type TroffSongData = {
  songKey: string;
  jsonDataInfo: string;
  fileUrl?: string;
};

export type TroffSongIdentifyer_sk = {
  groupDocId: string;
  songDocId: string;
  songKey: string;
};

export type TroffSongIdentifyer_fu = {
  groupDocId: string;
  songDocId: string;
  fileUrl: string;
};

export type TroffSongIdentifyer = {
  groupDocId: string;
  songDocId: string;
  songKey: string;
  fileUrl: string;
};

export type TroffSongAddedEvent = {
  detail: TroffSongIdentifyer;
};

export type TroffSongGroupMap = Record<string, TroffSongIdentifyer_fu[]>;

export type TroffFirebaseGroupIdentifyer = {
  color?: string;
  firebaseGroupDocId: string;
  icon?: string;
  id: number;
  info?: string;
  name: string;
  owners: string[];
  songs: TroffFirebaseSongIdentifyer[];
};

export type TroffFirebaseSongIdentifyer = {
  firebaseSongDocId: string;
  fullPath: string;
  galleryId: string;
};

export type TroffStateOfSonglists = {
  songListList: string[];
  galleryList: string[];
  directoryList: string[];
};

export interface TroffHtmlMarkerElement extends HTMLInputElement {
  timeValue: string | number;
  info: string;
  color: string;
}

export type BackendService = {
  getTroffData: (troffDataId: string, fileName: string) => Promise<any>;
};

export type TroffData = {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  troffDataPublic: boolean;
  troffDataUploadedMillis: number;
  markerJsonString: string;
};

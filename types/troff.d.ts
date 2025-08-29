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
}

export interface TroffMarker {
  color: string;
  id: string;
  info: string;
  name: string;
  time: number;
}

export interface TroffFileHandler {
  fetchAndSaveResponse: (fileUrl: string, songKey: string) => Promise<void>;
  saveResponse: (response: Response, url: string) => Promise<void>;
  saveFile: (file: File, callbackFunk: (url: string, file: File) => void) => Promise<void>;
  getObjectUrlFromResponse: (response: Response, songKey: string) => Promise<string>;
  getObjectUrlFromFile: (songKey: string) => Promise<string>;
  doesFileExistInCache: (url: string) => Promise<boolean>;
  sendFileToFirebase: (fileKey: string, storageDir: string) => Promise<[string, File]>;
  sendFile: (
    fileKey: string,
    oSongTroffInfo: any, // Could be more specific if you have a type for TroffData
    storageDir?: string
  ) => Promise<{
    id: number;
    fileUrl: string;
    fileName: string;
  }>;
  handleFiles: (files: FileList, callbackFunk: (url: string, file: File) => void) => void;
}

export type FirebaseWrapper = {
  uploadFile: (fileId: string, file: File, storageDir?: string) => Promise<string>;
  uploadTroffData: (troffData: any) => Promise<any>;
  onDownloadProgressUpdate?: (progress: number) => void;
  onUploadProgressUpdate?: (progress: number) => void;
};

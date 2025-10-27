export type ErrorHandler = {
  generic: (error: any) => void;
  // backendService_getTroffData: (error: any, serverId: string, fileName: string) => void;
  fileHandler_fetchAndSaveResponse: (error: any, fileName: string) => void;
  fileHandler_sendFile: (error: any, fileName: string) => void;
};

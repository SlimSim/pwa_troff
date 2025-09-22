export type ErrorHandler = {
  backendService_getTroffData: (error: any, serverId: string, fileName: string) => void;
  fileHandler_fetchAndSaveResponse: (error: any, fileName: string) => void;
  fileHandler_sendFile: (error: any, fileName: string) => void;
};

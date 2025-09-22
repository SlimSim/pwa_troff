export type DataTableColumnHelper = {
  list: DataTableColumn[];
  getPos: (id: string) => number;
};

export type DataTableColumn = {
  id: string;
  header: string;
  default: boolean;
  showOnAttachedState?: boolean;
  hideFromUser?: boolean;
};

export type ColumnToggleMap = {
  CHECKBOX: boolean;
  TYPE: boolean;
  DURATION: boolean;
  DISPLAY_NAME: boolean;
  TITLE: boolean;
  ARTIST: boolean;
  ALBUM: boolean;
  TEMPO: boolean;
  GENRE: boolean;
  LAST_MODIFIED: boolean;
  FILE_SIZE: boolean;
  INFO: boolean;
  EXTENSION: boolean;
};

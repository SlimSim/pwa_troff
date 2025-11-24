import { DataTableColumnHelper } from 'types/dataTables';
import { MarkerColorConfig } from 'types/markers';

export const TROFF_SETTING_SET_THEME: string = 'TROFF_SETTING_SET_THEME';
export const TROFF_SETTING_EXTENDED_MARKER_COLOR: string = 'TROFF_SETTING_EXTENDED_MARKER_COLOR';
export const TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR: string =
  'TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR';
export const TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR: string =
  'TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR';
export const TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR: string =
  'TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR';
export const TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR: string =
  'TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR';
export const TROFF_SETTING_ENTER_RESET_COUNTER: string = 'TROFF_SETTING_ENTER_RESET_COUNTER';
export const TROFF_SETTING_SPACE_RESET_COUNTER: string = 'TROFF_SETTING_SPACE_RESET_COUNTER';
export const TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER: string =
  'TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER';
export const TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR: string =
  'TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR';
export const TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR: string =
  'TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR';
export const TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR: string =
  'TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR';
export const TROFF_SETTING_PLAY_UI_BUTTON_SHOW_BUTTON: string =
  'TROFF_SETTING_PLAY_UI_BUTTON_SHOW_BUTTON';
export const TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER: string =
  'TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER';
export const TROFF_SETTING_CONFIRM_DELETE_MARKER: string = 'TROFF_SETTING_CONFIRM_DELETE_MARKER';
export const TROFF_SETTING_UI_ARTIST_SHOW: string = 'TROFF_SETTING_UI_ARTIST_SHOW';
export const TROFF_SETTING_UI_TITLE_SHOW: string = 'TROFF_SETTING_UI_TITLE_SHOW';
export const TROFF_SETTING_UI_ALBUM_SHOW: string = 'TROFF_SETTING_UI_ALBUM_SHOW';
export const TROFF_SETTING_UI_PATH_SHOW: string = 'TROFF_SETTING_UI_PATH_SHOW';
export const TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW: string =
  'TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW';
export const TROFF_SETTING_UI_ZOOM_SHOW: string = 'TROFF_SETTING_UI_ZOOM_SHOW';
export const TROFF_SETTING_UI_LOOP_BUTTONS_SHOW: string = 'TROFF_SETTING_UI_LOOP_BUTTONS_SHOW';
export const TROFF_SETTING_SONG_COLUMN_TOGGLE: string = 'TROFF_SETTING_SONG_COLUMN_TOGGLE';
export const TROFF_SETTING_SONG_LISTS_LIST_SHOW: string = 'TROFF_SETTING_SONG_LISTS_LIST_SHOW';
export const TROFF_CURRENT_STATE_OF_SONG_LISTS: string = 'TROFF_CURRENT_STATE_OF_SONG_LISTS';
export const TROFF_SETTING_SONG_LIST_ADDITIVE_SELECT: string =
  'TROFF_SETTING_SONG_LIST_ADDITIVE_SELECT';
export const TROFF_SETTING_SHOW_SONG_DIALOG: string = 'TROFF_SETTING_SHOW_SONG_DIALOG';
export const TROFF_TROFF_DATA_ID_AND_FILE_NAME: string = 'TROFF_TROFF_DATA_ID_AND_FILE_NAME';

export const MARKER_COLOR_PREFIX: string = 'markerColor';

export const MARKER_COLORS: MarkerColorConfig[] = [
  { name: 'Bisque', color: 'Bisque', onColor: '#000' },
  { name: 'Aqua', color: 'Aqua', onColor: '#000' },
  { name: 'Chartreuse', color: 'Chartreuse', onColor: '#000' },
  { name: 'Coral', color: 'Coral', onColor: '#000' },
  { name: 'Pink', color: 'Pink', onColor: '#000' },
  { name: 'Burlywood', color: 'Burlywood', onColor: '#000' },
  { name: 'Darkcyan', color: 'Darkcyan', onColor: '#000' },
  { name: 'Yellowgreen', color: 'Yellowgreen', onColor: '#000' },
  { name: 'Peru', color: 'Peru', onColor: '#000' },
  { name: 'Violet', color: 'Violet', onColor: '#000' },
  { name: 'Blue 1', color: '#99c1f1', onColor: '#000' },
  { name: 'Blue 2', color: '#62a0ea', onColor: '#f6f5f4' },
  { name: 'Blue 3', color: '#3584e4', onColor: '#f6f5f4' },
  { name: 'Blue 4', color: '#1c71d8', onColor: '#f6f5f4' },
  { name: 'Blue 5', color: '#1a5fb4', onColor: '#f6f5f4' },
  { name: 'Green 1', color: '#8ff0a4', onColor: '#000' },
  { name: 'Green 2', color: '#57e389', onColor: '#000' },
  { name: 'Green 3', color: '#33d17a', onColor: '#000' },
  { name: 'Green 4', color: '#2ec27e', onColor: '#000' },
  { name: 'Green 5', color: '#26a269', onColor: '#f6f5f4' },
  { name: 'Yellow 1', color: '#f9f06b', onColor: '#000' },
  { name: 'Yellow 2', color: '#f8e45c', onColor: '#000' },
  { name: 'Yellow 3', color: '#f6d32d', onColor: '#000' },
  { name: 'Yellow 4', color: '#f5c211', onColor: '#000' },
  { name: 'Yellow 5', color: '#e5a50a', onColor: '#000' },
  { name: 'Oragne 1', color: '#ffbe6f', onColor: '#000' },
  { name: 'Oragne 2', color: '#ffa348', onColor: '#000' },
  { name: 'Oragne 3', color: '#ff7800', onColor: '#f6f5f4' },
  { name: 'Oragne 4', color: '#e66100', onColor: '#f6f5f4' },
  { name: 'Oragne 5', color: '#c64600', onColor: '#f6f5f4' },
  { name: 'Red 1', color: '#f66151', onColor: '#000' },
  { name: 'Red 2', color: '#ed333b', onColor: '#f6f5f4' },
  { name: 'Red 3', color: '#e01b24', onColor: '#f6f5f4' },
  { name: 'Red 4', color: '#c01c28', onColor: '#f6f5f4' },
  { name: 'Red 5', color: '#a51d2d', onColor: '#f6f5f4' },
  { name: 'Purple 1', color: '#dc8add', onColor: '#000' },
  { name: 'Purple 2', color: '#c061cb', onColor: '#000' },
  { name: 'Purple 3', color: '#9141ac', onColor: '#f6f5f4' },
  { name: 'Purple 4', color: '#813d9c', onColor: '#f6f5f4' },
  { name: 'Purple 5', color: '#613583', onColor: '#f6f5f4' },
  { name: 'Brown 1', color: '#cdab8f', onColor: '#000' },
  { name: 'Brown 2', color: '#b5835a', onColor: '#f6f5f4' },
  { name: 'Brown 3', color: '#986a44', onColor: '#f6f5f4' },
  { name: 'Brown 4', color: '#865e3c', onColor: '#f6f5f4' },
  { name: 'Brown 5', color: '#63452c', onColor: '#f6f5f4' },
  { name: 'White', color: '#ffffff', onColor: '#333' },
  { name: 'Gray 1', color: '#f6f5f4', onColor: '#000' },
  { name: 'Gray 2', color: '#deddda', onColor: '#000' },
  { name: 'Gray 3', color: '#c0bfbc', onColor: '#000' },
  { name: 'Gray 4', color: '#9a9996', onColor: '#f6f5f4' },
  { name: 'Gray 5', color: '#77767b', onColor: '#f6f5f4' },
  { name: 'Gray 6', color: '#5e5c64', onColor: '#f6f5f4' },
  { name: 'Gray 7', color: '#3d3846', onColor: '#f6f5f4' },
  { name: 'Gray 8', color: '#241f31', onColor: '#f6f5f4' },
  { name: 'Black', color: '#000000', onColor: '#f6f5f4' },
];

export const DATA_TABLE_COLUMNS: DataTableColumnHelper = {
  list: [
    { id: 'CHECKBOX', header: 'Checkbox', default: true },
    { id: 'EDIT', header: 'Edit', default: true },
    { id: 'TYPE', header: 'Type', default: true },
    { id: 'DURATION', header: 'Duration', default: true },
    {
      id: 'DISPLAY_NAME',
      header: 'Name',
      default: true,
      showOnAttachedState: true,
    },
    { id: 'CUSTOM_NAME', header: 'Custom Name', default: false },
    { id: 'CHOREOGRAPHY', header: 'Choreography', default: false },
    { id: 'CHOREOGRAPHER', header: 'Choreographer', default: false },
    { id: 'TITLE', header: 'Title', default: false },
    { id: 'ARTIST', header: 'Artist', default: true },
    { id: 'ALBUM', header: 'Album', default: true },
    { id: 'TEMPO', header: 'Tempo', default: true },
    { id: 'GENRE', header: 'Genre', default: true },
    { id: 'TAGS', header: 'Tags', default: false },
    { id: 'LAST_MODIFIED', header: 'Modified', default: false },
    { id: 'FILE_SIZE', header: 'Size', default: false },
    { id: 'INFO', header: 'Song info', default: false },
    { id: 'EXTENSION', header: 'File type', default: false },
    { id: 'DATA_INFO', header: 'dataInfo', default: false, hideFromUser: true },
  ],
  getPos: (id) => {
    for (let i = 0; i < DATA_TABLE_COLUMNS.list.length; i++) {
      if (id === DATA_TABLE_COLUMNS.list[i].id) {
        return i;
      }
    }
    return -1;
  },
};

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

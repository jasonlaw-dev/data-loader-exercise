export interface DataColumn {
  columnName: string;
  width: number;
  dataType: 'TEXT' | 'BOOLEAN' | 'INTEGER' | string;
}

import { DataColumn } from './data-column';

export interface DataSpecification {
  key: string;
  columns: DataColumn[];
}

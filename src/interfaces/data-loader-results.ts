import { DataLoaderResult } from './data-loader-result';

export interface DataLoaderResults {
  [filename: string]: DataLoaderResult;
}

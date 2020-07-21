export interface DataLoaderResult {
  reportDate: Date;
  linesProcessed: number;
  linesSaved: number;
  errors: Error[];
}

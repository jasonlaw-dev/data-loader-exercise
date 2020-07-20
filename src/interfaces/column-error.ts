export class ColumnError extends Error {
  constructor(public columnName: string, public errorMessage: string) {
    super(`Column ${columnName} - ${errorMessage}`);
  }
}

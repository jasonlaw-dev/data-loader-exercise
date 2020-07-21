export class LineError extends Error {
  constructor(public lineNumber: number, public columnName: string, public errorMessage: string) {
    super(`Line ${lineNumber} - ${columnName} - ${errorMessage}`);
  }
}

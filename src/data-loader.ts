/* eslint-disable no-underscore-dangle */
import fs from 'fs';
import Knex from 'knex';
import path from 'path';
import { ChunkedLineStream } from './chunked-line-stream';
import { DbHelper } from './db-helper';
import { DataLoaderResult } from './interfaces/data-loader-result';
import { DataLoaderResults } from './interfaces/data-loader-results';
import { DataSpecification } from './interfaces/data-specification';
import { LineError } from './interfaces/line-error';

interface DataLoaderOptionsOptional {
  chunkSize?: number;
  skipErrorLines?: boolean;
}

interface DataLoaderOptionsRequired {
  baseDir: string;
  spec: DataSpecification;
  knex: Knex;
  schema: string;
}

export type DataLoaderOptions = DataLoaderOptionsOptional & DataLoaderOptionsRequired;

export class DataLoader {
  private suffixRegex = /_([0-9]{4}-[0-9]{2}-[0-9]{2})\.txt$/i;

  private options: Required<DataLoaderOptions>;

  constructor(
    options: DataLoaderOptions,
  ) {
    this.options = {
      chunkSize: 10000,
      skipErrorLines: true,
      ...options,
    };
  }

  /**
   * Load files that matches the key on the specification in the baseDir
   */
  async loadFiles(): Promise<DataLoaderResults> {
    const { key } = this.options.spec;
    const filenames = (await fs.promises.readdir(this.options.baseDir))
      .filter((filename) => (
        // Check the filename length to ensure we are not loading files from another spec
        filename.length === key.length + 14
        && filename.startsWith(key)
        && this.suffixRegex.test(filename)
      ));
    const results: DataLoaderResults = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const filename of filenames) {
      results[filename] = await this.loadFile(filename);
    }
    return results;
  }

  /**
   * Load a given file by overwriting existing records with the same reportDate.
   * The delete and insert operations are wrapped in a transaction to ensure consistency
   *
   * The data file is read chunk by chunk to prevent out of memory error if the file is huge
   * This assumes the database has a mechanism of saving uncommitted transactions to disk.
   * @param filename filename to be loaded
   */
  async loadFile(filename: string): Promise<DataLoaderResult> {
    const match = filename.match(this.suffixRegex);
    if (match == null) {
      throw new Error('Filename does not match the required format');
    }

    const reportDate = new Date(match[1]);
    if (Number.isNaN(reportDate.getTime())) {
      throw new Error('Invalid date in filename');
    }

    const {
      knex, baseDir, chunkSize, spec, schema,
    } = this.options;

    const filePath = path.join(baseDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    let linesProcessed = 0;
    let linesSaved = 0;
    const errors: Error[] = [];

    const stream = new ChunkedLineStream(filePath);

    await DbHelper.ensureTable(knex, schema, spec);

    const txn = await knex.transaction();

    const builder = () => knex(spec.key).withSchema(schema).transacting(txn);

    await builder().where('_reportDate', reportDate).delete();
    const process = async (lines: string[]) => {
      try {
        const processed = await this.processLines(lines, linesProcessed + 1, reportDate);
        await builder().insert(processed.results);
        linesSaved += processed.results.length;
        linesProcessed += lines.length;
        errors.push(...processed.errors);
        console.log(`[${filename}]: Saved: ${processed.results.length}, totalSaved: ${linesSaved}, Errors: ${processed.errors.length}`);
      } catch (e) {
        console.error(e);
        errors.push(e);
      }
    };

    try {
      let chunk: null | string[] = null;
      // eslint-disable-next-line no-cond-assign
      while (chunk = await stream.readChunk(chunkSize)) {
        await process(chunk);
      }
      if (errors.length > 0 && !this.options.skipErrorLines) {
        linesSaved = 0;
        await txn.rollback();
      } else {
        await txn.commit();
      }
    } catch (e) {
      linesSaved = 0;
      await txn.rollback();
      errors.push(e);
    }

    return {
      reportDate, linesProcessed, linesSaved, errors,
    };
  }

  private async processLines(lines: string[], lineNumberStart: number, reportDate: Date) {
    const results: object[] = [];
    const errors: Error[] = [];
    lines.forEach((line, index) => {
      if (line) { // skip blank lines
        try {
          const result = this.processLine(line, lineNumberStart + index);
          result._reportDate = reportDate;
          results.push(result);
        } catch (e) {
          errors.push(e);
        }
      }
    });
    return { results, errors };
  }

  private processLine(line: string, lineNumber: number) {
    let i = 0;
    const result: any = {};
    this.options.spec.columns.forEach((col) => {
      if (i >= line.length) {
        return;
      }
      let value: any = null;
      let valueString = line.substr(i, col.width);

      if (col.dataType === 'BOOLEAN') {
        if (!['0', '1'].includes(valueString)) {
          throw new LineError(lineNumber, col.columnName, 'is not 0 or 1');
        }
        value = valueString !== '0';
      } else if (col.dataType === 'INTEGER') {
        valueString = valueString.trim();
        if (valueString) { // use null if string is empty
          value = parseInt(valueString, 10);
          if (Number.isNaN(value) || !(/^-?[0-9]+$/.test(valueString))) {
            throw new LineError(lineNumber, col.columnName, 'is not a number');
          }
        }
      } else if (col.dataType === 'TEXT') {
        value = valueString.trimRight(); // treating whitespaces in the front as intended
      } else {
        throw new LineError(lineNumber, col.columnName, 'unexpected data type');
      }
      result[col.columnName] = value;
      i += col.width;
    });
    return result;
  }
}

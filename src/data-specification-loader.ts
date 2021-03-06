import fs from 'fs';
import csvParse from 'csv-parse';
import path from 'path';
import { ColumnError } from './interfaces/column-error';
import { DataColumn } from './interfaces/data-column';
import { DataSpecification } from './interfaces/data-specification';

export class DataSpecificationLoader {
  private static columnMap: { [key: string]: string } = {
    'column name': 'columnName',
    width: 'width',
    datatype: 'dataType',
  };

  constructor(private baseDir: string) {
  }

  /**
   * Load all specifications in csv in the baseDir specified
   * @return an object containing specs and errors loaded
   */
  async loadSpecifications() {
    const filenames = (await fs.promises.readdir(this.baseDir))
      .filter((filename) => filename.endsWith('.csv'));
    const specs: DataSpecification[] = [];
    const errors: Error[] = [];
    await Promise.all(filenames.map((filename) => (
      this.loadSpecification(filename).then(
        (spec) => specs.push(spec),
        (error) => errors.push(error),
      )
    )));
    return { specs, errors };
  }

  /**
   * Load specification from the specified csv file
   * @param filename filename of the specification
   */
  async loadSpecification(filename: string): Promise<DataSpecification> {
    const fileBuffer = await fs.promises.readFile(path.join(this.baseDir, filename));
    const columns: DataColumn[] = await new Promise((resolve, reject) => {
      csvParse(
        fileBuffer,
        {
          columns: (header: string[]) => (
            header.map((column) => DataSpecificationLoader.columnMap[column])
          ),
          cast: (value, context) => {
            if (context.column === 'width') {
              return parseInt(value, 10);
            }
            return value;
          },
        },
        (err, records) => (err ? reject(err) : resolve(records)),
      );
    });
    if (!columns.length) {
      throw new Error('No columns found');
    }
    const processedColumnNames: { [key: string]: boolean; } = {};
    columns.forEach((column) => {
      if (!column.columnName || !column.columnName.match(/^[_a-zA-Z][_a-zA-Z0-9]*$/)) {
        throw new ColumnError(column.columnName, 'invalid column name');
      }
      if (Number.isNaN(column.width) || column.width <= 0) {
        throw new ColumnError(column.columnName, 'invalid width');
      }
      if (!['TEXT', 'BOOLEAN', 'INTEGER'].includes(column.dataType)) {
        throw new ColumnError(column.columnName, 'invalid data type');
      }
      if (column.dataType === 'BOOLEAN' && column.width !== 1) {
        throw new ColumnError(column.columnName, 'boolean width must be 1');
      }
      if (processedColumnNames[column.columnName]) {
        throw new ColumnError(column.columnName, 'duplicate column name');
      }
      processedColumnNames[column.columnName] = true;
    });
    return {
      key: filename.replace(/\.csv$/, ''),
      columns,
    };
  }
}

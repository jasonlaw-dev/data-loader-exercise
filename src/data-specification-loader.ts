import fs from 'fs';
import csvParse from 'csv-parse';
import path from 'path';
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

  async loadSpecifications(): Promise<DataSpecification[]> {
    const filenames = (await fs.promises.readdir(this.baseDir))
      .filter((filename) => filename.endsWith('.csv'));
    return Promise.all(filenames.map((filename) => this.loadSpecification(filename)));
  }

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
    return {
      key: filename.replace(/\.csv$/, ''),
      columns,
    };
  }
}

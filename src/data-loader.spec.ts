import Knex from 'knex';
import fs from 'fs';
import { DataLoader } from './data-loader';
import { DataSpecification } from './interfaces/data-specification';

describe('Data Loader', () => {
  const spec: DataSpecification = {
    key: 'testformat1',
    columns: [
      {
        columnName: 'name',
        width: 10,
        dataType: 'TEXT',
      },
      {
        columnName: 'valid',
        width: 1,
        dataType: 'BOOLEAN',
      },
      {
        columnName: 'count',
        width: 3,
        dataType: 'INTEGER',
      },
    ],
  };
  const knex = Knex(fs.readFileSync('knex-config.json', { encoding: 'utf8' }));
  const schema = 'data_loader_test_schema';
  const loader = new DataLoader({
    baseDir: 'data',
    spec,
    knex,
    schema,
  });

  const createSchema = () => knex.schema.createSchema(schema);
  const dropSchema = () => knex.raw(`${knex.schema.dropSchemaIfExists(schema).toQuery()} cascade`);

  beforeEach(async () => {
    await dropSchema();
    await createSchema();
  });

  after(async () => {
    await knex.destroy();
  });

  describe('Loading data file', function () {
    this.timeout(100000);
    it('should load the sample test file', async () => {
      await loader.loadFile('testformat1_2015-06-28.txt');
    });
  });
});

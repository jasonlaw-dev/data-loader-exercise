import { expect } from 'chai';
import fs, { WriteStream } from 'fs';
import Knex from 'knex';
import * as path from 'path';
import { DataLoader } from './data-loader';
import { DataSpecification } from './interfaces/data-specification';

describe('Data Loader', () => {
  const sampleSpec: DataSpecification = {
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
      {
        columnName: 'num1',
        width: 10,
        dataType: 'INTEGER',
      },
    ],
  };
  const sampleInput = fs.readFileSync('data/testformat1_2015-06-28.txt', { encoding: 'utf8' });
  const sampleOutput = [
    {
      name: 'Foonyor',
      valid: true,
      count: 1,
      num1: 123123123,
    },
    {
      name: 'Barzane',
      valid: false,
      count: -12,
      num1: 523556123,
    },
    {
      name: 'Quuxitude',
      valid: true,
      count: 103,
      num1: -123567,
    },
  ];

  const knexConfig = JSON.parse(fs.readFileSync('knex-config.json', { encoding: 'utf8' }));
  const knex = Knex(knexConfig);
  const schema = 'data_loader_test_schema';

  const createSchema = () => knex.schema.createSchema(schema);
  const dropSchema = () => knex.raw(`${knex.schema.dropSchemaIfExists(schema).toQuery()} cascade`);

  beforeEach(async () => {
    await dropSchema();
    await createSchema();
  });

  after(async () => {
    await knex.destroy();
  });

  describe('Loading sample data file', () => {
    const loader = new DataLoader({
      baseDir: 'data',
      spec: sampleSpec,
      knex,
      schema,
    });

    it('should load the sample test file', async () => {
      const {
        reportDate, linesSaved, errors, linesProcessed,
      } = await loader.loadFile('testformat1_2015-06-28.txt');
      expect(linesSaved).to.equal(3);
      expect(linesProcessed).to.equal(linesSaved + 1); // empty last lione
      expect(errors).to.have.lengthOf(0);
      const dbResults = await knex(sampleSpec.key).withSchema(schema).where('_reportDate', reportDate);
      expect(dbResults).to.have.lengthOf(linesSaved);
      dbResults.forEach((dbResult, index) => {
        expect(dbResult).to.include(sampleOutput[index]);
      });
    });

    it('should load the sample test file with errors', async () => {
      const {
        reportDate, linesSaved, errors, linesProcessed,
      } = await loader.loadFile('testformat1_2015-06-29.txt');
      expect(linesSaved).to.equal(1);
      expect(linesProcessed).to.equal(4); // empty last lione
      expect(errors).to.have.lengthOf(2);
      const dbResults = await knex(sampleSpec.key).withSchema(schema).where('_reportDate', reportDate);
      expect(dbResults).to.have.lengthOf(linesSaved);
      expect(errors[0].message).to.include('Line 1 - valid - is not 0 or 1');
      expect(errors[1].message).to.include('Line 2 - num1 - is not a number');
    });

    it('should load multiple sample test files', async () => {
      const results = await loader.loadFiles();
      const filenames = Object.keys(results);
      expect(filenames).to.include('testformat1_2015-06-28.txt');
      expect(filenames[1]).to.include('testformat1_2015-06-29.txt');
      const dbResults = await knex(sampleSpec.key).withSchema(schema).select();
      expect(dbResults).to.have.lengthOf(dbResults.length);
    });
  });
  describe('Loading generated data files', function () {
    this.timeout(1000 * 60);
    const loader = new DataLoader({
      baseDir: 'data-test',
      spec: sampleSpec,
      knex,
      schema,
    });
    const testCases: {
      description: string;
      count: number;
      input: (writeStream: WriteStream) => void;
    }[] = [
      {
        description: '30k rows',
        count: 30000,
        input: (writeStream) => {
          for (let i = 0; i < 10000; i++) {
            writeStream.write(sampleInput);
          }
        },
      },
      {
        description: '3m rows',
        count: 3000000,
        input: (writeStream) => {
          for (let i = 0; i < 1000000; i++) {
            writeStream.write(sampleInput);
          }
        },
      },
    ];
    testCases.forEach((testCase, index) => {
      it(`should work for ${testCase.description}`, async () => {
        const reportDate = new Date(new Date('2020-01-01').getTime() + index * 1000 * 60 * 60 * 24);
        const filename = `testformat1_${reportDate.toISOString().substr(0, 10)}.txt`;
        const writeStream = fs.createWriteStream(path.join('data-test', filename));
        testCase.input(writeStream);
        await new Promise((resolve) => writeStream.end(resolve));
        await loader.loadFile(filename);
        const [{ count: dbCount }] = await knex(sampleSpec.key).withSchema(schema).count();
        expect(parseInt(dbCount, 10)).to.equal(testCase.count);
      });
    });
  });
});

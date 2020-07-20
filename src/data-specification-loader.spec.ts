import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { DataSpecificationLoader } from './data-specification-loader';

describe('Data Specification Loader', () => {
  const loader = new DataSpecificationLoader('specs');
  const verifySpecification = async (filename: string) => {
    const expectedJsonFilePath = path.join('specs-expected', filename.replace(/\.csv/, '.json'));
    if (!fs.existsSync(expectedJsonFilePath)) {
      throw new Error('Expected Json file does not exist');
    }
    const [expected, actual] = await Promise.all([
      (async () => JSON.parse(await fs.promises.readFile(expectedJsonFilePath, 'utf8')))(),
      loader.loadSpecification(filename),
    ]);
    expect(actual).to.deep.equal(expected);
  };
  describe('Loading specification', () => {
    it('should load the sample test file', async () => {
      await verifySpecification('testformat1.csv');
    });
  });
});

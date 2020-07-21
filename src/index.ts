import fs from 'fs';
import Knex from 'knex';
import { DataLoader } from './data-loader';
import { DataSpecificationLoader } from './data-specification-loader';

const run = async () => {
  const knexConfig = JSON.parse(fs.readFileSync('knex-config.json', { encoding: 'utf8' }));
  const knex = Knex(knexConfig);
  const { specs, errors } = await new DataSpecificationLoader('specs').loadSpecifications();
  await Promise.all(specs.map(async (spec) => {
    const loader = new DataLoader({
      knex,
      schema: 'public',
      spec,
      baseDir: 'data',
    });
    await loader.loadFiles();
  }));
  if (errors.length > 0) {
    console.error(errors);
  }
};

run().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

import Knex, { ColumnInfo } from 'knex';
import { DataColumn } from './interfaces/data-column';
import { DataSpecification } from './interfaces/data-specification';

interface ColumnInfos { [key: string]: ColumnInfo; }

export class DbHelper {
  /**
   * If table exists, check if it matches the columns in specification,
   * otherwise create the table
   * @param knex Knex instance
   * @param schema name of the schema to use
   * @param spec Data Specification to ensure
   */
  static async ensureTable(knex: Knex, schema: string, spec: DataSpecification) {
    const builder = () => knex.schema.withSchema(schema);
    if (await builder().hasTable(spec.key)) {
      const columnInfo: ColumnInfos = (
        await knex.withSchema(schema).table(spec.key).columnInfo()
      ) as any;
      const columns: DataColumn[] = [
        { columnName: '_reportDate', dataType: 'DATE', width: 10 },
        ...spec.columns,
      ];
      columns.forEach((col) => {
        if (!columnInfo[col.columnName]) {
          throw new Error(`Existing table ${spec.key} has no column ${col.columnName}`);
        }
        const expectedType = col.dataType.toLowerCase();
        const actualType = columnInfo[col.columnName].type;
        if (expectedType !== actualType) {
          throw new Error(
            `Existing table ${spec.key}'s column ${col.columnName} has type ${actualType} instead of ${expectedType}`,
          );
        }
      });
    } else {
      await builder().createTable(spec.key, (table) => {
        table.bigIncrements().primary();
        table.date('_reportDate').notNullable().index();
        spec.columns.forEach((col) => {
          if (col.dataType === 'BOOLEAN') {
            table.boolean(col.columnName);
          } else if (col.dataType === 'INTEGER') {
            table.integer(col.columnName);
          } else if (col.dataType === 'TEXT') {
            table.text(col.columnName);
          }
        });
      });
    }
  }
}

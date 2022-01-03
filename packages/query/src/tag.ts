import { parsers, ParserType } from '@pgtyped/types';
import { SQLQuery as QueryAST } from './loader/sql';
import { parseTSQuery, TSQueryAST } from './loader/typescript';
import { processSQLQueryAST } from './preprocessor-sql';
import { processTSQueryAST } from './preprocessor-ts';

type RowsReturn = { rows: any[] };
export interface IDatabaseConnection {
  query: (config: {
    text: string;
    values?: any[];
    types?: { getTypeParser(oid: number): ParserType };
  }) => Promise<RowsReturn>;
}

/* Used for SQL-in-TS */
export class TaggedQuery<TTypePair extends { params: any; result: any }> {
  public run: (
    params: TTypePair['params'],
    dbConnection: IDatabaseConnection,
  ) => Promise<Array<TTypePair['result']>>;

  private readonly query: TSQueryAST;

  constructor(query: TSQueryAST) {
    this.query = query;
    this.run = async (params, connection) => {
      const { query: processedQuery, bindings } = processTSQueryAST(
        this.query,
        params as any,
      );
      const result = await connection.query({
        text: processedQuery,
        types: {
          getTypeParser(oid: number) {
            return parsers[oid] ?? ((x: string) => x);
          },
        },
        values: bindings,
      });
      return result.rows;
    };
  }
}

interface ITypePair {
  params: any;
  result: any;
}

const sql = <TTypePair extends ITypePair>(
  stringsArray: TemplateStringsArray,
) => {
  const { query } = parseTSQuery(stringsArray[0]);
  return new TaggedQuery<TTypePair>(query);
};

/* Used for pure SQL */
export class PreparedQuery<TParamType, TResultType> {
  public run: (
    params: TParamType,
    dbConnection: IDatabaseConnection,
  ) => Promise<Array<TResultType>>;

  private readonly query: QueryAST;

  constructor(query: QueryAST) {
    this.query = query;
    this.run = async (params, connection) => {
      const {
        query: processedQuery,
        bindings,
        columnsToTransform,
      } = await processSQLQueryAST(this.query, params as any);

      const result = await connection.query({
        text: processedQuery,
        types: {
          getTypeParser(oid: number) {
            return parsers[oid] ?? ((x: string) => x);
          },
        },
        values: bindings,
      });
      return result.rows;
    };
  }
}

type ColumnTransformerFunctions = {
  [transformName: string]: (value: any) => any;
};
//
// const columnTransformerFunctions: ColumnTransformerFunctions = {
//   stringRange: (value: string) => {
//     const [start, end] = value.split(',');
//   },
// };
//
// function transformResultRows(
//   result: RowsReturn,
//   columnsToTransform: ColumnsToTransform,
// ): any[] {
//   if (columnsToTransform) {
//     for (const row of result.rows) {
//       for (const [colIndex, transformName] of Object.entries(
//         columnsToTransform,
//       )) {
//         row[colIndex] = columnTransformerFunctions[transformName]?.(
//           row[colIndex],
//         );
//       }
//     }
//   }
//
//   return result.rows;
// }

export default sql;

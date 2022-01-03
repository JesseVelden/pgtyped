export { getTypes, startup, IParseError } from './actions';

export {
  ParamTransform,
  IQueryParameters,
  IInterpolatedQuery,
} from './preprocessor';

export { processTSQueryAST } from './preprocessor-ts';
export { processSQLQueryAST } from './preprocessor-sql';

export { AsyncQueue } from '@pgtyped/wire';

export {
  default as parseTypeScriptFile,
  TSQueryAST,
} from './loader/typescript';

export {
  default as parseSQLFile,
  SQLQueryAST,
  prettyPrintEvents,
} from './loader/sql';

export { default as sql, TaggedQuery, PreparedQuery } from './tag';

export interface TypeInfo {
  oid: number;
  customType?: string;
}

export interface QueryParam {
  name: string;
  required: boolean;
  type?: TypeInfo;
}

export interface Query {
  name: string;
  params: QueryParam[];
}

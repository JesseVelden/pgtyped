import { OIDs } from './oids';
import { parsers } from './parsers';

export class PGTypedTypesError extends Error {}

export interface RangeBound<T> {
  /**
   * The value of the bound. This can be null if it is unbounded/ infinite, as they are functionally the same.
   */
  value: T | null;
  inclusive: boolean;
}

export interface Range<T> {
  start: RangeBound<T> | null;
  end: RangeBound<T> | null;
}

export type ParserType = (rawPostgresString: string) => any;
export type SerializerType = (value: any) => string | Promise<string>;

export { parsers, OIDs };

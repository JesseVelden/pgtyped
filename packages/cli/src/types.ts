// Default types
import {
  isAlias,
  isEnum,
  isEnumArray,
  isImport,
  isRange,
  MappableType,
  RangeType,
  Type,
} from '@pgtyped/query/lib/type';

const String: Type = { name: 'string' };
const Number: Type = { name: 'number' };
const Boolean: Type = { name: 'boolean' };
const Date: Type = { name: 'Date' };
const Bytes: Type = { name: 'Buffer' };
const Void: Type = { name: 'undefined' };
const Json: Type = {
  name: 'Json',
  definition:
    'null | boolean | number | string | Json[] | { [key: string]: Json }',
};
const getArray = (baseType: Type): Type => ({
  name: `${baseType.name}Array`,
  definition: `(${baseType.definition ?? baseType.name})[]`,
});

// const getRangeValue = (baseType: Type): Type => ({
//   name: `${baseType.name}RangeBound`,
//   definition: `{ value: ${baseType.name}; inclusive: boolean }`,
// });

const StringRange: RangeType = {
  name: 'StringRange',
  definition: `{ start: RangeBound<string>; end: RangeBound<string> }`,
  isRange: true,
};

const NumberRange: RangeType = {
  name: 'NumberRange',
  definition: `{ start: RangeBound<number>; end: RangeBound<number> }`,
  isRange: true,
};

// const getRange = (rangeType: NamedType): RangeType => ({
//     name: `${rangeType.name}Range`,
//     definition: `{ start: ${rangeType.name}; end: ${rangeType.name}; bounds: RangeBounds }`,
//     isRange: true,
// });

export const DefaultTypeMapping = Object.freeze({
  // TODO Convert to OIDs
  // Integer types
  int2: Number,
  int4: Number,
  int8: String,
  smallint: Number,
  int: Number,
  bigint: String,

  // Precision types
  real: Number,
  float4: Number,
  float: Number,
  float8: Number,
  numeric: String,
  decimal: String,

  // Serial types
  smallserial: Number,
  serial: Number,
  bigserial: String,

  // Common string types
  uuid: String,
  text: String,
  varchar: String,
  char: String,
  bpchar: String,
  citext: String,
  name: String,

  // Bool types
  bit: Boolean, // TODO: better bit array support
  bool: Boolean,
  boolean: Boolean,

  // Dates and times
  date: Date,
  timestamp: Date,
  timestamptz: Date,
  time: Date,
  timetz: Date,
  interval: String,

  // Network address types
  inet: String,
  cidr: String,
  macaddr: String,
  macaddr8: String,

  // Extra types
  money: String,
  void: Void,

  // JSON types
  json: Json,
  jsonb: Json,

  // Bytes
  bytea: Bytes,

  // Postgis types
  point: getArray(Number),

  // Range types
  int4range: NumberRange,
  int8range: StringRange,
  numrange: StringRange,

  // For a date we're also using strings as time/date bounds in ranges are formatted according to Postgres’ current
  //   DateStyle setting and not as ISO 8601 which is the case with normal date types.
  tsrange: StringRange,
  tstzrange: StringRange,
  dateRange: StringRange,
});

export type BuiltinTypes = keyof typeof DefaultTypeMapping;

export type TypeMapping = Record<BuiltinTypes, Type> & Record<string, Type>;

export function TypeMapping(overrides?: Partial<TypeMapping>): TypeMapping {
  return { ...DefaultTypeMapping, ...overrides };
}

function declareImport([...names]: Set<string>, from: string): string {
  return `import { ${names.sort().join(', ')} } from '${from}';\n`;
}

function declareAlias(name: string, definition: string): string {
  return `export type ${name} = ${definition};\n`;
}

function declareStringUnion(name: string, values: string[]) {
  return declareAlias(
    name,
    values
      .sort()
      .map((v) => `'${v}'`)
      .join(' | '),
  );
}

/** Wraps a TypeMapping to track which types have been used, to accumulate errors,
 * and emit necessary type definitions. */
export class TypeAllocator {
  errors: Error[] = [];
  // from -> names
  imports: { [k: string]: Set<string> } = {};
  // name -> definition (if any)
  types: { [k: string]: Type } = {};

  constructor(
    private mapping: TypeMapping,
    private allowUnmappedTypes?: boolean,
  ) {}

  isMappedType(name: string | number): name is keyof TypeMapping {
    return name in this.mapping;
  }

  /** Lookup a database-provided type name in the allocator's map */
  use(typeNameOrType: MappableType): string {
    let typ: Type | null = null;

    if (typeof typeNameOrType == 'string') {
      if (typeNameOrType[0] === '_') {
        // If starts with _ it is an PG Array type

        const arrayValueType = typeNameOrType.slice(1);
        // ^ Converts _varchar -> varchar, then wraps the type in an array
        // type wrapper
        if (this.isMappedType(arrayValueType)) {
          typ = getArray(this.mapping[arrayValueType]);
        }
      }

      if (typ == null) {
        if (!this.isMappedType(typeNameOrType)) {
          if (this.allowUnmappedTypes) {
            return typeNameOrType;
          }
          this.errors.push(
            new Error(
              `Postgres type '${typeNameOrType}' is not supported by mapping`,
            ),
          );
          return 'unknown';
        }
        typ = this.mapping[typeNameOrType];
      }
    } else {
      if (isEnumArray(typeNameOrType)) {
        typ = getArray(typeNameOrType.elementType);
        // make sure the element type is used so it appears in the declaration
        this.use(typeNameOrType.elementType);
      } else {
        typ = typeNameOrType;
      }
    }

    let isRangeType = false;
    if (isRange(typ)) {
      this.imports['@pgtyped/types'] = (
        this.imports['@pgtyped/types'] ?? new Set()
      ).add('RangeBound');
      isRangeType = true;
      // this.use(getRangeValue(typ.rangeType));
      // typ = {
      //   ...typ,
      //   definition: `{ start: ${typ.rangeType.name}; end: ${typ.rangeType.name}; bounds: RangeBounds }`,
      // };
    }

    // Track type on first occurrence
    this.types[typ.name] = this.types[typ.name] ?? typ;

    // Merge imports
    if (isImport(typ)) {
      this.imports[typ.from] = (this.imports[typ.from] ?? new Set()).add(
        typ.name,
      );
    }

    return typ.name;
  }

  /** Emit a typescript definition for all types that have been used */
  declaration(): string {
    const imports = Object.entries(this.imports)
      .map(([from, names]) => declareImport(names, from))
      .sort()
      .join('\n');

    // Declare database enums as string unions to maintain assignability of their values between query files
    const enums = Object.values(this.types)
      .filter(isEnum)
      .map((t) => declareStringUnion(t.name, t.enumValues))
      .sort()
      .join('\n');

    const aliases = Object.values(this.types)
      .filter(isAlias)
      .map((t) => declareAlias(t.name, t.definition))
      .sort()
      .join('\n');

    return [imports, enums, aliases].filter((s) => s).join('\n');
  }
}

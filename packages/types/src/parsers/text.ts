import array from 'postgres-array';
// @ts-ignore
import parseByteA from 'postgres-bytea';
import parseTimestampTz from 'postgres-date';
import parseInterval from 'postgres-interval';
import { ParserType } from '../index';
import { OIDs } from '../oids';
import { parseRange } from './range';

interface Point {
  x: number;
  y: number;
}

interface Circle extends Point {
  radius?: number;
}

function parseBool(value: string) {
  return (
    value === 'TRUE' ||
    value === 't' ||
    value === 'true' ||
    value === 'y' ||
    value === 'yes' ||
    value === 'on' ||
    value === '1'
  );
}

function parseBoolArray(value: string) {
  return array.parse(value, parseBool);
}

function parseBaseTenInt(value: string) {
  return parseInt(value, 10);
}

function parseIntegerArray(value: string) {
  return array.parse(value, parseBaseTenInt);
}

function parseBigIntegerArray(value: string) {
  return array.parse(value, function (entry) {
    return parseBigInteger(entry).trim();
  });
}

const parsePointArray = function (value: string) {
  return array.parse(value, parsePoint);
};

const parseFloatArray = function (value: string) {
  return array.parse(value, parseFloat);
};

const parseStringArray = function (value: string) {
  return array.parse(value);
};

const parseTimestamp = function (value: string) {
  const utc = value.endsWith(' BC') ? value.slice(0, -3) + 'Z BC' : value + 'Z';

  return parseTimestampTz(utc);
};

const parseTimestampArray = function (value: string) {
  return array.parse(value, parseTimestamp);
};

const parseTimestampTzArray = function (value: string) {
  return array.parse(
    value,
    parseTimestampTz as (isoDate: string) => Date | null,
  );
};

const parseIntervalArray = function (value: string) {
  return array.parse(value, parseInterval);
};

const parseByteAArray = function (value: string) {
  return array.parse(value, parseByteA);
};

const parseBigInteger = function (value: string) {
  const valStr = String(value);
  if (/^\d+$/.test(valStr)) {
    return valStr;
  }
  return value;
};

const parseJsonArray = function (value: string) {
  return array.parse(value, JSON.parse);
};

const parsePoint = function (value: string): Point | null {
  if (value[0] !== '(') {
    return null;
  }

  const coordinate = value.substring(1, value.length - 1).split(',');

  return {
    x: parseFloat(coordinate[0]),
    y: parseFloat(coordinate[1]),
  };
};

const parseCircle = function (value: string) {
  if (value[0] !== '<' && value[1] !== '(') {
    return null;
  }

  let point = '(';
  let radius = '';
  let pointParsed = false;
  for (let i = 2; i < value.length - 1; i++) {
    if (!pointParsed) {
      point += value[i];
    }

    if (value[i] === ')') {
      pointParsed = true;
      continue;
    }

    if (!pointParsed || value[i] === ',') {
      continue;
    }

    radius += value[i];
  }
  const result = parsePoint(point) as Circle;
  result!.radius = parseFloat(radius);

  return result;
};

export function parseInt4Range(raw: string) {
  return parseRange(raw, parseBaseTenInt);
}

export function parseNumRange(raw: string) {
  return parseRange(raw, parseFloat);
}

export function parseInt8Range(raw: string) {
  return parseRange(raw, parseBigInteger);
}

export function parseTimestampRange(raw: string) {
  return parseRange(raw, parseTimestamp);
}

export function parseTimestampTzRange(raw: string) {
  return parseRange(raw, parseTimestampTz as (isoDate: string) => Date | null);
}

export const parsers: Record<number, ParserType> = {
  [OIDs.BOOL]: parseBool,
  [OIDs.BYTEA]: parseByteA,
  [OIDs.INT8]: parseBigInteger,
  [OIDs.INT2]: parseBaseTenInt,
  [OIDs.INT4]: parseBaseTenInt,
  [OIDs.OID]: parseBaseTenInt,
  [OIDs.JSON]: JSON.parse,
  [OIDs.JSONB]: JSON.parse,
  [OIDs.FLOAT4]: parseFloat,
  [OIDs.FLOAT8]: parseFloat,
  [OIDs.TIMESTAMP]: parseTimestamp,
  [OIDs.TIMESTAMPTZ]: parseTimestampTz,
  [OIDs.POINT]: parsePoint,
  [OIDs.CIDRARRAY]: parseStringArray,
  [OIDs.CIRCLE]: parseCircle,
  [OIDs.BOOLARRAY]: parseBoolArray,
  [OIDs.BYTEAARRAY]: parseByteAArray,
  [OIDs.INT8ARRAY]: parseBigIntegerArray,
  [OIDs.INT2ARRAY]: parseIntegerArray,
  [OIDs.INT4ARRAY]: parseIntegerArray,
  [OIDs.OIDARRAY]: parseIntegerArray,
  [OIDs.POINTARRAY]: parsePointArray,
  [OIDs.FLOAT4ARRAY]: parseFloatArray,
  [OIDs.FLOAT8ARRAY]: parseFloatArray,
  [OIDs.NUMERICARRAY]: parseStringArray,
  [OIDs.BPCHARARRAY]: parseStringArray,
  [OIDs.VARCHARARRAY]: parseStringArray,
  [OIDs.REGPROCARRAY]: parseStringArray,
  [OIDs.TEXTARRAY]: parseStringArray,
  [OIDs.MACADDRARRAY]: parseStringArray,
  [OIDs.INETARRAY]: parseStringArray,
  [OIDs.TIMESTAMPARRAY]: parseTimestampArray,
  [OIDs.DATEARRAY]: parseStringArray,
  [OIDs.TIMESTAMPTZARRAY]: parseTimestampTzArray,
  [OIDs.INTERVAL]: parseInterval,
  [OIDs.INTERVALARRAY]: parseIntervalArray,
  [OIDs.BYTEA]: parseByteA,
  [OIDs.JSONARRAY]: parseJsonArray,
  [OIDs.JSONBARRAY]: parseJsonArray,
  [OIDs.NUMRANGE]: parseNumRange,
  [OIDs.NUMRANGEARRAY]: parseStringArray,
  [OIDs.TSRANGE]: parseTimestampRange,
  [OIDs.TSTZRANGE]: parseTimestampTzRange,
  [OIDs.DATERANGE]: parseRange,
  [OIDs.INT4RANGE]: parseInt4Range,
  [OIDs.INT8RANGE]: parseInt8Range,
  [OIDs.UUIDARRAY]: parseStringArray,
  [OIDs.MONEYARRAY]: parseStringArray,
  [OIDs.TIMEARRAY]: parseStringArray,
  [OIDs.TIMETZARRAY]: parseStringArray,
};

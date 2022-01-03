import { OIDs, Range, SerializerType } from '../index';
import { arrayString } from './array';
import { serializeDateAsUTC, serializeDateAtLocalTimezone } from './date';
import { serializeRange } from './range';

const pg = null;
// Convert values from javascript types
// to their 'raw' counterparts for use as a postgres parameter
export const prepareValue = function (
  value: Record<string, any> | null,
  seen?: Record<string, any>[] | undefined,
): string | Buffer | null {
  // null and undefined are both null for postgres
  if (value == null) {
    return null;
  }
  if (value instanceof Buffer) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    const buf = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    if (buf.length === value.byteLength) {
      return buf;
    }
    return buf.slice(value.byteOffset, value.byteOffset + value.byteLength); // Node.js v4 does not support those Buffer.from params
  }
  if (value instanceof Date) {
    return serializeDate(value);
  }
  if (Array.isArray(value)) {
    return arrayString(value);
  }
  if (typeof value === 'object') {
    return prepareObject(value, seen);
  }
  return (value as any).toString();
};

function serializeDate(value: Date) {
  return pg?.defaults?.parseInputDatesAsUTC
    ? serializeDateAsUTC(value)
    : serializeDateAtLocalTimezone(value);
}

function prepareObject(
  val: Record<string, any>,
  seen: Record<string, any>[] | undefined,
): string {
  if (val && typeof val.toPostgres === 'function') {
    seen = seen || [];
    if (seen.indexOf(val) !== -1) {
      throw new Error(
        'circular reference detected while preparing "' + val + '" for query',
      );
    }
    seen.push(val);

    return <string>prepareValue(val.toPostgres(prepareValue), seen);
  }
  return JSON.stringify(val);
}

function serializeJSONBArray(value: any[]) {
  return JSON.stringify(value);
}

function serializeAnyRange(value: Range<number>) {
  return serializeRange(value, (x: any) => x.toString());
}

function serializeDateRange(value: Range<Date>) {
  return serializeRange(value, serializeDate);
}

export default {
  // In order to prevent the default array serializer from being used for JSON arrays,
  // we need to treat them differently. As we have the OID information we can use this
  // Numeric, string, boolean, object, JSON and array types, do not have special serializers.
  // A simple .toString() will be used for simple types, and use some magic detecting
  //  object, date, array types.
  [OIDs.JSONARRAY]: serializeJSONBArray,
  [OIDs.JSONBARRAY]: serializeJSONBArray,

  // Range types are custom as well. Could also be used in prepareValue if we use a Range class, instead of a object.

  [OIDs.NUMRANGE]: serializeAnyRange,
  [OIDs.INT4RANGE]: serializeAnyRange,
  [OIDs.INT8RANGE]: serializeAnyRange,
  [OIDs.TSRANGE]: serializeDateRange,
  [OIDs.TSTZRANGE]: serializeDateRange,
  [OIDs.DATERANGE]: serializeDateRange,

  //TODO: points, circle,
} as Record<number, SerializerType>;

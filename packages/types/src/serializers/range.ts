import { Range } from '../index';

export function serializeRange<T>(
  range: Range<T>,
  format: (value: T) => string = (x) => x as any,
): string {
  let s = '';
  if (range.start === null && range.end === null) {
    return 'empty';
  }

  s += range.start?.inclusive ? '[' : '(';
  s += range.start?.value ? serializeBound(format(range.start.value)) : '';
  s += ',';
  s += range.end?.value ? serializeBound(format(range.end.value)) : '';
  s += range.end?.inclusive ? ']' : ')';

  return s;
}

function serializeBound(boundValue: string): string {
  const containsSpecialChars = (char: string) =>
    char === '"' ||
    char === '\\' ||
    char === '(' ||
    char === ')' ||
    char === '[' ||
    char === ']' ||
    char === ',' ||
    char === ' ';

  let needsQuotes = false;
  let position = 0;
  let value = '';

  if (boundValue === null || boundValue.length === 0) {
    return '""';
  }

  boundValue = boundValue.trim();

  // First we unfortunately need to loop in order to check if it contains special characters.
  for (let i = 0; i < boundValue.length; i++) {
    if (containsSpecialChars(boundValue[i])) {
      needsQuotes = true;
      // If that's the case, we need to surround the value with quotes.
      value += '"';
      break;
    }
  }

  let pointer = 0;
  for (; pointer < boundValue.length; pointer++) {
    const character = boundValue[pointer];

    if (character === '"' || character === '\\') {
      value += boundValue.slice(position, pointer + 1) + character;
      position = pointer + 1;
    }
  }

  if (pointer > position) {
    value += boundValue.slice(position, pointer);
  }

  if (needsQuotes) {
    value += '"';
  }

  return value;
}

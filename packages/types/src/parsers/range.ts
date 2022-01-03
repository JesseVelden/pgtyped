import { Range } from '../index';

const INFINITY = 'infinity';

export function parseRange<T>(
  input: string,
  transform: (value: string) => T = (value) => value as any,
): Range<T> {
  input = input.trim();

  if (input === 'empty') {
    return { start: null, end: null };
  }

  // Using a simple parser, since regex matching is slower.
  let startInclusive = false;
  if (input[0] === '[') {
    startInclusive = true;
  } else if (input[0] !== '(') {
    throw new Error(`Invalid range start: ${input[0]}. Expected '[' or '('`);
  }

  let pointer = 1;
  const startBound = parseBound(input, pointer);
  pointer = startBound.pointer;

  if (input[pointer] !== ',') {
    throw new Error('Expected a comma character, got: ' + input[pointer]);
  }

  const endBound = parseBound(input, pointer + 1);
  let endInclusive = false;
  if (input[endBound.pointer] == ']') {
    endInclusive = true;
  } else if (input[endBound.pointer] !== ')') {
    throw new Error(
      `Invalid range end: ${input[endBound.pointer]}. Expected ']' or ')'`,
    );
  }

  return {
    start: {
      value:
        startBound.valueString != null
          ? transform(startBound.valueString)
          : null,
      inclusive: startInclusive,
    },
    end: {
      value:
        endBound.valueString != null ? transform(endBound.valueString) : null,
      inclusive: endInclusive,
    },
  };
}

function parseBound(
  input: string,
  pointer: number,
): { valueString: string | null; pointer: number } {
  const boundIsEnding = (input: string, pointer: number): boolean =>
    input[pointer] === ',' || input[pointer] === ')' || input[pointer] === ']';

  if (boundIsEnding(input, pointer)) {
    return {
      valueString: null,
      pointer,
    };
  }

  let inQuote = false;
  let value = '';
  let position = pointer;

  while (inQuote || !boundIsEnding(input, pointer)) {
    // We loop until we find the end of the bound, or a quote/ escape character
    const character = input[pointer++];

    if (character === undefined) {
      throw new Error(`Unexpected end of input. Position: ${pointer}`);
    }

    const escaped = character === '\\';
    if (escaped) {
      if (input[pointer] === undefined) {
        throw new Error(`Unexpected end of input. Position: ${pointer}`);
      }

      value += input.slice(position, pointer - 1) + input[pointer];
      pointer += 1;
      position = pointer;
      continue;
    }

    if (character === '"') {
      if (!inQuote) {
        inQuote = true;
        position += 1;
        continue;
      }

      if (input[pointer] === '"') {
        value += input.slice(position, pointer - 1) + input[pointer];
        pointer += 1;
        position = pointer;
        continue;
      }

      inQuote = false;
      value += input.slice(position, pointer - 1);
      position = pointer + 1;
    }
  }

  if (pointer > position) {
    value += input.slice(position, pointer);
  }

  return {
    valueString: value.endsWith(INFINITY) ? null : value,
    pointer,
  };
}

import { Range } from '../index';
import { parseRange } from './range';

test('parse invalid Postgres range without a comma', () => {
  expect(() => parseRange('', (x) => x)).toThrowError(
    "Invalid range start: undefined. Expected '[' or '('",
  );
});

test('parse empty range', () => {
  const result = parseRange('empty', (x) => x);
  expect(result).toEqual({ start: null, end: null });

  expect(parseRange('(,)', (x) => x)).toEqual({
    start: {
      value: null,
      inclusive: false,
    },
    end: {
      value: null,
      inclusive: false,
    },
  });
});

test('parse infinite range', () => {
  const result = parseRange('[-infinity,infinity)', (x) => x);
  expect(result).toEqual({
    start: {
      value: null,
      inclusive: true,
    },
    end: {
      value: null,
      inclusive: false,
    },
  });
});

test('parse integers', () => {
  const check = (a: string, b: Range<string>) =>
    expect(parseRange(a, (x) => x)).toEqual(b);

  check('(0,)', {
    start: {
      value: '0',
      inclusive: false,
    },
    end: {
      value: null,
      inclusive: false,
    },
  });

  check('[0,1)', {
    start: {
      value: '0',
      inclusive: true,
    },
    end: {
      value: '1',
      inclusive: false,
    },
  });

  check('[1,2]', {
    start: {
      value: '1',
      inclusive: true,
    },
    end: {
      value: '2',
      inclusive: true,
    },
  });

  check('(,10]', {
    start: {
      value: null,
      inclusive: false,
    },
    end: {
      value: '10',
      inclusive: true,
    },
  });
});

test('parse valid date ranges', () => {
  const check = (a: string, b: Range<string>) =>
    expect(parseRange(a, (x) => x)).toEqual(b);

  check('["2021-12-31 10:19:24.036+01","2022-01-01 10:19:24.035+01"]', {
    start: {
      value: '2021-12-31 10:19:24.036+01',
      inclusive: true,
    },
    end: {
      value: '2022-01-01 10:19:24.035+01',
      inclusive: true,
    },
  });

  check('[2021-12-31 10:19:24.036+01,2022-01-01 10:19:24.035+01)', {
    start: {
      value: '2021-12-31 10:19:24.036+01',
      inclusive: true,
    },
    end: {
      value: '2022-01-01 10:19:24.035+01',
      inclusive: false,
    },
  });

  check('(,2022-01-01 10:19:24.035+01)', {
    start: {
      value: null,
      inclusive: false,
    },
    end: {
      value: '2022-01-01 10:19:24.035+01',
      inclusive: false,
    },
  });

  check('(-infinity,2022-01-01 10:19:24.035+01)', {
    start: {
      value: null,
      inclusive: false,
    },
    end: {
      value: '2022-01-01 10:19:24.035+01',
      inclusive: false,
    },
  });

  check('[2022-01-01 10:19:24.035+01,infinity)', {
    start: {
      value: '2022-01-01 10:19:24.035+01',
      inclusive: true,
    },
    end: {
      value: null,
      inclusive: false,
    },
  });

  check('(2010-10-30 10:54:13.74-05:30,2010-10-31 14:54:13.74-05:30]', {
    start: {
      value: '2010-10-30 10:54:13.74-05:30',
      inclusive: false,
    },
    end: {
      value: '2010-10-31 14:54:13.74-05:30',
      inclusive: true,
    },
  });
});

test('parse strings', () => {
  const check = (a: string, b: Range<string>) =>
    expect(parseRange(a, (x) => x)).toEqual(b);

  check('(,"")', {
    start: {
      value: null,
      inclusive: false,
    },
    end: {
      value: '',
      inclusive: false,
    },
  });

  check('("A","Z")', {
    start: {
      value: 'A',
      inclusive: false,
    },
    end: {
      value: 'Z',
      inclusive: false,
    },
  });

  check('(A,Z)', {
    start: {
      value: 'A',
      inclusive: false,
    },
    end: {
      value: 'Z',
      inclusive: false,
    },
  });

  check('("""A""","""Z""")', {
    start: {
      value: '"A"',
      inclusive: false,
    },
    end: {
      value: '"Z"',
      inclusive: false,
    },
  });

  check('("\\"A\\"","\\"Z\\"")', {
    start: {
      value: '"A"',
      inclusive: false,
    },
    end: {
      value: '"Z"',
      inclusive: false,
    },
  });

  check('("\\(A\\)","\\(Z\\)")', {
    start: {
      value: '(A)',
      inclusive: false,
    },
    end: {
      value: '(Z)',
      inclusive: false,
    },
  });

  check('("\\[A\\]","\\[Z\\]")', {
    start: {
      value: '[A]',
      inclusive: false,
    },
    end: {
      value: '[Z]',
      inclusive: false,
    },
  });
});

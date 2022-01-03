import { serializeDateAsUTC } from './date';
import { serializeRange } from './range';

test('serialize empty range', () => {
  expect(serializeRange({ start: null, end: null })).toEqual('empty');
});

test('serialize unbounded range', () => {
  expect(
    serializeRange({
      start: {
        value: null,
        inclusive: true,
      },
      end: {
        value: null,
        inclusive: true,
      },
    }),
  ).toEqual('[,]');
});

test('serialize date range', () => {
  expect(
    serializeRange(
      {
        start: {
          value: new Date('2020-04-13T00:00:00.000+08:00'),
          inclusive: true,
        },
        end: {
          value: null,
          inclusive: false,
        },
      },
      (x) => serializeDateAsUTC(x),
    ),
  ).toEqual('[2020-04-12T16:00:00.000+00:00,)');
});

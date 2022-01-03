export function serializeDateAtLocalTimezone(date: Date): string {
  let offset = -date.getTimezoneOffset();

  let year = date.getFullYear();
  const isBCYear = year < 1;
  if (isBCYear) year = Math.abs(year) + 1; // negative years are 1 off their BC representation

  let ret =
    pad(year, 4) +
    '-' +
    pad(date.getMonth() + 1, 2) +
    '-' +
    pad(date.getDate(), 2) +
    'T' +
    pad(date.getHours(), 2) +
    ':' +
    pad(date.getMinutes(), 2) +
    ':' +
    pad(date.getSeconds(), 2) +
    '.' +
    pad(date.getMilliseconds(), 3);

  if (offset < 0) {
    ret += '-';
    offset *= -1;
  } else {
    ret += '+';
  }

  ret += pad(Math.floor(offset / 60), 2) + ':' + pad(offset % 60, 2);
  if (isBCYear) ret += ' BC';
  return ret;
}

export function serializeDateAsUTC(date: Date): string {
  let year = date.getUTCFullYear();
  const isBCYear = year < 1;
  if (isBCYear) year = Math.abs(year) + 1; // negative years are 1 off their BC representation

  let ret =
    pad(year, 4) +
    '-' +
    pad(date.getUTCMonth() + 1, 2) +
    '-' +
    pad(date.getUTCDate(), 2) +
    'T' +
    pad(date.getUTCHours(), 2) +
    ':' +
    pad(date.getUTCMinutes(), 2) +
    ':' +
    pad(date.getUTCSeconds(), 2) +
    '.' +
    pad(date.getUTCMilliseconds(), 3);

  ret += '+00:00';
  if (isBCYear) ret += ' BC';
  return ret;
}

function pad(number: number, digits: number) {
  let stringifiedNumber = '' + number;
  while (stringifiedNumber.length < digits) {
    stringifiedNumber = '0' + stringifiedNumber;
  }
  return stringifiedNumber;
}

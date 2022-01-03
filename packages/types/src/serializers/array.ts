import { prepareValue } from './index';

function escapeElement(elementRepresentation: string) {
  const escaped = elementRepresentation
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  return '"' + escaped + '"';
}

// convert a JS array to a postgres array literal
// uses a comma separator so won't work for types like box that use
// a different array separator.
export function arrayString(val: string | any[]): string {
  let result = '{';
  for (let i = 0; i < val.length; i++) {
    if (i > 0) {
      result = result + ',';
    }
    if (val[i] === null || typeof val[i] === 'undefined') {
      result = result + 'NULL';
    } else if (Array.isArray(val[i])) {
      result = result + arrayString(val[i]);
    } else if (val[i] instanceof Buffer) {
      result += '\\\\x' + val[i].toString('hex');
    } else {
      result += escapeElement(prepareValue(val[i]) as string);
    }
  }
  result = result + '}';
  return result;
}

export function isString(data) {
  return typeof data === 'string';
}

export function isNumber(data) {
  return typeof data === 'number' && Number.isFinite(data);
}

export function isPositiveInt(data) {
  return Number.isInteger(data) && data > 0;
}

export function isPlainObject(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(data);
  return prototype === Object.prototype || prototype === null;
}

export function isEmpty(data) {
  if (data === null || data === undefined) return true;
  if (typeof data === 'string') return data.trim().length === 0;
  if (Array.isArray(data)) return data.length === 0;
  if (isPlainObject(data)) return Object.keys(data).length === 0;
  return false;
}

export function isNotEmpty(data) {
  return !isEmpty(data);
}

export function isNotEmptyArray(data) {
  return Array.isArray(data) && data.length !== 0;
}

export function isCorrectStatus(enums, status) {
  return Object.values(enums).includes(status);
}

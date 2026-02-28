const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

const camelToSnakeKey = (key) =>
  key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

const snakeToCamelKey = (key) =>
  key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export const toSnake = (value) => {
  if (Array.isArray(value)) return value.map(toSnake);
  if (!isObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [camelToSnakeKey(k), toSnake(v)]),
  );
};

export const toCamel = (value) => {
  if (Array.isArray(value)) return value.map(toCamel);
  if (!isObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [snakeToCamelKey(k), toCamel(v)]),
  );
};

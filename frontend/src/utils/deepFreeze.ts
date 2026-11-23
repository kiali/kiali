// Match former deep-freeze behavior: freeze nested objects and functions so accidental
// mutation of static config exports throws in strict mode.
export const deepFreeze = <T>(obj: T): T => {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return obj;
  }

  Object.freeze(obj);

  for (const name of Object.getOwnPropertyNames(obj)) {
    const value: unknown = (obj as Record<string, unknown>)[name];
    if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }

  return obj;
};

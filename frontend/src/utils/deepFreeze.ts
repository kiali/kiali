// Recursively freezes plain nested objects at module load so accidental mutation throws.
// For static config exports only.
export const deepFreeze = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  Object.freeze(obj);

  for (const name of Object.getOwnPropertyNames(obj)) {
    const value: unknown = (obj as Record<string, unknown>)[name];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }

  return obj;
};

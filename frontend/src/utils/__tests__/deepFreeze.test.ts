import { deepFreeze } from '../deepFreeze';

describe('deepFreeze', () => {
  it('returns primitives and null unchanged', () => {
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze('x')).toBe('x');
    expect(deepFreeze(null)).toBe(null);
  });

  it('freezes nested objects and arrays', () => {
    const frozen = deepFreeze({ a: { b: 1 }, items: [2, { n: 3 }] });

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.a)).toBe(true);
    expect(Object.isFrozen(frozen.items)).toBe(true);
    expect(Object.isFrozen(frozen.items[1])).toBe(true);

    expect(() => {
      (frozen as { a: { b: number } }).a.b = 2;
    }).toThrow();
    expect(() => {
      (frozen as { items: number[] }).items.push(4);
    }).toThrow();
  });

  it('freezes nested functions', () => {
    const endpoint = (): string => 'api/foo';
    const frozen = deepFreeze({ urls: { get: endpoint } });

    expect(Object.isFrozen(frozen.urls.get)).toBe(true);
    expect(() => {
      (frozen.urls.get as { extra?: string }).extra = 'x';
    }).toThrow();
  });

  it('is idempotent', () => {
    const once = deepFreeze({ a: 1 });
    const twice = deepFreeze(once);

    expect(twice).toBe(once);
    expect(Object.isFrozen(twice)).toBe(true);
  });

  it('skips already frozen children', () => {
    const inner = Object.freeze({ x: 1 });
    const frozen = deepFreeze({ inner });

    expect(Object.isFrozen(frozen.inner)).toBe(true);
    expect(() => {
      (frozen.inner as { x: number }).x = 2;
    }).toThrow();
  });
});

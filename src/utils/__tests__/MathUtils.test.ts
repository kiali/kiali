import * as MathUtils from '../MathUtils';

describe('MathUtils.clamp', () => {
  it('should clamp to lower value', () => {
    expect(MathUtils.clamp(0, 5, 8)).toEqual(5);
  });
  it('should clamp to higher value', () => {
    expect(MathUtils.clamp(10, 5, 8)).toEqual(8);
  });
  it('should return value if in range', () => {
    expect(MathUtils.clamp(6, 5, 8)).toEqual(6);
  });
  it('should return be inclusive on the lower bound', () => {
    expect(MathUtils.clamp(5, 5, 8)).toEqual(5);
  });
  it('should return be inclusive on the upper bound', () => {
    expect(MathUtils.clamp(8, 5, 8)).toEqual(8);
  });
});

describe('MathUtils.quadraticBezier', () => {
  it('should yield the p0 on t=0', () => {
    expect(MathUtils.quadraticBezier({ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 8, y: 1 }, 0)).toMatchObject({ x: 1, y: 1 });
  });
  it('should yield the p2 on t=1', () => {
    expect(MathUtils.quadraticBezier({ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 8, y: 1 }, 1)).toMatchObject({ x: 8, y: 1 });
  });
  it('should yield correct value for t=0.7', () => {
    const result = MathUtils.quadraticBezier({ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 8, y: 1 }, 0.7);
    expect(result.x).toBeCloseTo(6.11);
    expect(result.y).toBeCloseTo(2.68);
  });
  it('should yield correct value for t=0.25', () => {
    const result = MathUtils.quadraticBezier({ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 8, y: 1 }, 0.25);
    expect(result.x).toBeCloseTo(2.9375);
    expect(result.y).toBeCloseTo(2.5);
  });
});

describe('MathUtils.linearInterpolation', () => {
  it('should yield the p0 on t=0', () => {
    expect(MathUtils.linearInterpolation({ x: 1, y: 1 }, { x: 5, y: 5 }, 0)).toMatchObject({ x: 1, y: 1 });
  });
  it('should yield the p1 on t=1', () => {
    expect(MathUtils.linearInterpolation({ x: 1, y: 1 }, { x: 5, y: 5 }, 1)).toMatchObject({ x: 5, y: 5 });
  });
  it('should yield correct value for t=0.7', () => {
    const result = MathUtils.linearInterpolation({ x: 1, y: 1 }, { x: 5, y: 5 }, 0.7);
    expect(result.x).toBeCloseTo(3.8);
    expect(result.y).toBeCloseTo(3.8);
  });
  it('should yield correct value for t=0.25', () => {
    const result = MathUtils.linearInterpolation({ x: 1, y: 1 }, { x: 8, y: 1 }, 0.25);
    expect(result.x).toBeCloseTo(2.75);
    expect(result.y).toBeCloseTo(1);
  });
});

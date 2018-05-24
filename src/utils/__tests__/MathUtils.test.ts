import * as MathUtils from '../MathUtils';

describe('MathUtils', () => {
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

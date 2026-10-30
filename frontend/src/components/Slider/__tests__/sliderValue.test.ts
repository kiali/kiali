import { capSliderValue } from '../sliderValue';

describe('capSliderValue', () => {
  it('returns value when no cap is set', () => {
    expect(capSliderValue(75, 0)).toBe(75);
  });

  it('clamps to valueCap', () => {
    expect(capSliderValue(80, 0, 40)).toBe(40);
  });

  it('does not go below min', () => {
    expect(capSliderValue(-5, 0, 100)).toBe(0);
  });
});

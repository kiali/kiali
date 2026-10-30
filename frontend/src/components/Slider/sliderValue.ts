export const capSliderValue = (value: number, min: number, valueCap?: number): number => {
  const capped = valueCap === undefined ? value : Math.min(valueCap, value);
  return Math.max(min, capped);
};

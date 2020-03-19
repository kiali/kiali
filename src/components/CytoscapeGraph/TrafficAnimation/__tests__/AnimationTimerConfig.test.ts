import { AnimationTimerConfig } from '../AnimationTimerConfig';

describe('AnimationTimeConfig', () => {
  it('should produce baseDelay*1000 with rate 1', () => {
    let baseDelay = 1;
    let timerConfig = new AnimationTimerConfig(baseDelay);
    timerConfig.resetCalibration();
    timerConfig.calibrate(1);
    let delay = timerConfig.computeDelay(1);
    expect(delay).toEqual(1000 * baseDelay);

    baseDelay = 4;
    timerConfig = new AnimationTimerConfig(baseDelay);
    timerConfig.resetCalibration();
    timerConfig.calibrate(1);
    delay = timerConfig.computeDelay(1);
    expect(delay).toEqual(1000 * baseDelay);
  });

  it('should scale inversely proportional', () => {
    const timerConfig = new AnimationTimerConfig(4);
    const rates = [10, 20, 30];
    timerConfig.resetCalibration();
    rates.forEach(r => timerConfig.calibrate(r));
    const [d1, d2, d3] = rates.map(r => timerConfig.computeDelay(r));
    expect(d1).toEqual(2 * d2);
    expect(d1).toEqual(3 * d3);
  });

  it('should clamp low rates', () => {
    const timerConfig = new AnimationTimerConfig(4);
    const rates = [0.001, 0.01, 0.1, 1];
    timerConfig.resetCalibration();
    rates.forEach(r => timerConfig.calibrate(r));
    const [d1, d2, d3, d4] = rates.map(r => timerConfig.computeDelay(r));
    // Unit: 1 => baseDelay * 1000
    expect(d4).toEqual(4000);
    // Others reach max 5000 => clamped
    expect(d1).toEqual(5000);
    expect(d2).toEqual(5000);
    expect(d3).toEqual(5000);
  });

  it('should be kept in bounds with high rates', () => {
    const timerConfig = new AnimationTimerConfig(4);
    const rates = [1, 100, 1000, 2000];
    timerConfig.resetCalibration();
    rates.forEach(r => timerConfig.calibrate(r));
    const [d1, d2, d3, d4] = rates.map(r => timerConfig.computeDelay(r));
    // Due to upscaling, unit 1 is now out of bounds, so clamped to 5000
    expect(d1).toEqual(5000);
    // Others are within bounds, so still proportional to each other
    expect(d3).toEqual(d2 / 10);
    expect(d4).toEqual(d2 / 20);
  });
});

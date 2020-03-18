import { clamp } from 'utils/MathUtils';

const initialThreshold = 50;

class AnimationTimerConfig {
  threshold: number;

  // baseDelay: for a rate of 1 rps/bps, there will be one dot every `baseDelay` second.
  constructor(public baseDelay: number) {
    this.threshold = initialThreshold;
  }

  resetCalibration() {
    this.threshold = initialThreshold;
  }

  calibrate(rate: number) {
    if (rate > this.threshold / 1.5) {
      this.threshold = 3 * rate;
    }
  }

  computeDelay(rate: number) {
    if (isNaN(rate) || rate === 0) {
      return undefined;
    }
    const scaleFactor = this.scaleFactor();
    const d = (1000 * this.baseDelay * scaleFactor) / rate;
    return clamp(d, 40, 5000);
  }

  private scaleFactor() {
    if (this.threshold > 100000) {
      return Math.pow(this.threshold / initialThreshold, 0.9);
    }
    if (this.threshold > 1000) {
      return Math.pow(this.threshold / initialThreshold, 0.95);
    }
    return this.threshold / initialThreshold;
  }
}

export const timerConfig = new AnimationTimerConfig(1);
export const tcpTimerConfig = new AnimationTimerConfig(4);

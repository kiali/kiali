import { EdgeAnimationSpeed } from '@patternfly/react-topology';
import { clamp } from 'utils/MathUtils';

// Some information about the mathematical problem here:
// We try to project a set of RATE values from an upper-unbounded interval [0, +Inf] to a set of TIMER DELAY values in
//    a bounded interval [40ms, 5000ms] (arbitrary bounds).
// TIMER DELAY is the delay for dots generation in the animation. The lower it is, the more dots there are.
//
// The constraints are:
// - We'd like the relation to be inversely proportional: if RATE 1 is twice as big as RATE 2, DELAY 1 must be half of DELAY 2.
// - The animations should be quite representative of volumetry both _relatively_ and _absolutely_: _relatively_ is the
//    previous constraint (edges compared to each other); but _absolutely_ is another thing: regardless edges compared to
//    each other, we should have a notion of low and high traffic.
//
// To better understand the issue, we can imagine two rates R1 = 0.001 rps and R2 = 0.1 rps. R2 should have 100 times more
//    dots than R1. So it's likely to be "crowded", and looks like a high volumetry if we only consider the relative
//    relationships. But thinking in absolute, 0.1 rps is small, it shouldn't be crowded.

const initialThreshold = 50;
const maxDelay = 5000;
const minDelay = 40;

export class AnimationTimerConfig {
  private threshold: number;
  private scaleFactor: number;

  // baseDelay: for a rate of 1 rps/bps, there will be one dot every `baseDelay` seconds.
  constructor(private baseDelay: number) {
    this.threshold = initialThreshold;
    this.scaleFactor = 1;
  }

  resetCalibration() {
    this.threshold = initialThreshold;
    this.scaleFactor = 1;
  }

  calibrate(rate: number) {
    // We make this.threshold grow with max rate
    // The scale factor for this graph is updated with the changed threshold.
    if (rate > this.threshold) {
      this.threshold = 2 * rate;
      this.scaleFactor = this.computeScaleFactor();
    }
  }

  computeDelay(rate: number): number | undefined {
    if (isNaN(rate) || rate === 0) {
      return undefined;
    }
    // TIMER DELAY is inversely proportional to RATE. Scale factor is used to keep as much as possible TIMER DELAY in bounds
    const d = (1000 * this.baseDelay * this.scaleFactor) / rate;
    // In case it's out of bounds, clamp to bounds. Only case where proportionality is broken. Should only happen for very low values.
    return clamp(d, minDelay, maxDelay) as number;
  }

  private computeScaleFactor() {
    // Scale factor is how much values are upscaled compared to the initial threshold that is used with low rates
    // Some arbitrary thresholds are used to amplify high volumetry
    if (this.threshold > 100000) {
      return Math.pow(this.threshold / initialThreshold, 0.9);
    }
    if (this.threshold > 1000) {
      return Math.pow(this.threshold / initialThreshold, 0.95);
    }
    return this.threshold / initialThreshold;
  }

  computeAnimationSpeed(rate: number): EdgeAnimationSpeed {
    const range = maxDelay - minDelay;
    const chunk = range / 5; // there are 5 animation speeds for PFT
    const delay = this.computeDelay(rate);
    switch (true) {
      case !delay:
        return EdgeAnimationSpeed.none;
      case delay! < chunk:
        return EdgeAnimationSpeed.fast;
      case delay! < 2 * chunk:
        return EdgeAnimationSpeed.mediumFast;
      case delay! < 3 * chunk:
        return EdgeAnimationSpeed.medium;
      case delay! < 4 * chunk:
        return EdgeAnimationSpeed.mediumSlow;
      default:
        return EdgeAnimationSpeed.slow;
    }
  }
}

// HTTP config: 1 RPS => 1 dot every second
export const timerConfig = new AnimationTimerConfig(1);
// TCP config: 20 bps => 1 dot every second
export const tcpTimerConfig = new AnimationTimerConfig(20);

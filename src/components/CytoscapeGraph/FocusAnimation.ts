import { PfColors } from '../Pf/PfColors';

const FRAME_RATE = 1 / 30;
const MAX_RADIO = 60;
const LINE_WIDTH = 1;

const ANIMATION_DURATION = 800;

type OnFinishedCallback = () => void;

export default class FocusAnimation {
  private animationTimer;
  private startTimestamp;
  private elements;
  private onFinishedCallback: OnFinishedCallback;

  private readonly layer;
  private readonly context;

  constructor(cy: any) {
    this.layer = cy.cyCanvas();
    this.context = this.layer.getCanvas().getContext('2d');
    cy.one('destroy', () => this.stop());
  }

  onFinished(onFinishedCallback: OnFinishedCallback) {
    this.onFinishedCallback = onFinishedCallback;
  }

  start(elements: any) {
    this.stop();
    this.elements = elements;
    this.animationTimer = window.setInterval(this.processStep, FRAME_RATE * 1000);
  }

  stop() {
    if (this.animationTimer) {
      window.clearInterval(this.animationTimer);
      this.animationTimer = undefined;
      this.clear();
    }
  }

  clear() {
    this.layer.clear(this.context);
  }

  processStep = () => {
    try {
      if (this.startTimestamp === undefined) {
        this.startTimestamp = Date.now();
      }
      const current = Date.now();
      const step = (current - this.startTimestamp) / ANIMATION_DURATION;
      this.layer.clear(this.context);
      this.layer.setTransform(this.context);

      if (step >= 1) {
        this.stop();
        if (this.onFinishedCallback) {
          this.onFinishedCallback();
        }
        return;
      }

      this.elements.forEach(element => this.render(element, (1 - step) * MAX_RADIO));
    } catch (exception) {
      // If a step failed, the next step is likely to fail.
      // Stop the rendering and throw the exception
      this.stop();
      throw exception;
    }
  };

  private getCenter(element: any) {
    if (element.isNode()) {
      return element.position();
    } else {
      return element.midpoint();
    }
  }

  private render(element: any, radio: number) {
    const { x, y } = this.getCenter(element);
    this.context.strokeStyle = PfColors.Black;
    this.context.lineWidth = LINE_WIDTH;
    this.context.beginPath();
    this.context.arc(x, y, radio, 0, 2 * Math.PI, true);
    this.context.stroke();
  }
}

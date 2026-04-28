// Tracks an element's content height via ResizeObserver with hysteresis
// to avoid layout thrashing from sub-pixel fluctuations.
export class ResizeHeightObserver {
  private lastHeight = 0;
  private observer: ResizeObserver | null = null;
  private target: Element | null = null;

  constructor(private onHeight: (height: number) => void, private hysteresis = 2, private minHeight = 0) {}

  observe(element: Element): void {
    if (element === this.target) {
      return;
    }

    this.unobserve();
    this.lastHeight = 0;

    if (!this.observer) {
      this.observer = new ResizeObserver(entries => {
        const h = entries[0]?.contentRect.height ?? 0;

        if (h > this.minHeight && Math.abs(h - this.lastHeight) >= this.hysteresis) {
          this.lastHeight = h;
          this.onHeight(h);
        }
      });
    }

    this.observer.observe(element);
    this.target = element;
  }

  unobserve(): void {
    if (this.target) {
      this.observer?.unobserve(this.target);
      this.target = null;
    }
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.target = null;
  }
}

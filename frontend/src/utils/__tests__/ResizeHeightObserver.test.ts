import { ResizeHeightObserver } from '../ResizeHeightObserver';

function makeEntry(height: number): ResizeObserverEntry {
  return ({ contentRect: { height } } as unknown) as ResizeObserverEntry;
}

let fireResize: (entries: ResizeObserverEntry[]) => void;

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    const self = (this as unknown) as ResizeObserver;
    fireResize = (entries): void => cb(entries, self);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('ResizeHeightObserver', () => {
  const originalRO = global.ResizeObserver;

  beforeEach(() => {
    global.ResizeObserver = (MockResizeObserver as unknown) as typeof ResizeObserver;
  });

  afterEach(() => {
    global.ResizeObserver = originalRO;
  });

  it('should invoke onHeight when height exceeds hysteresis', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight);
    const el = document.createElement('div');

    observer.observe(el);
    fireResize([makeEntry(100)]);

    expect(onHeight).toHaveBeenCalledWith(100);
  });

  it('should not invoke onHeight when height change is below hysteresis', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight, 5);
    const el = document.createElement('div');

    observer.observe(el);
    fireResize([makeEntry(100)]);
    onHeight.mockClear();

    fireResize([makeEntry(103)]);
    expect(onHeight).not.toHaveBeenCalled();
  });

  it('should invoke onHeight when height change meets hysteresis threshold', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight, 5);
    const el = document.createElement('div');

    observer.observe(el);
    fireResize([makeEntry(100)]);
    onHeight.mockClear();

    fireResize([makeEntry(105)]);
    expect(onHeight).toHaveBeenCalledWith(105);
  });

  it('should not invoke onHeight when height is at or below minHeight', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight, 2, 50);
    const el = document.createElement('div');

    observer.observe(el);

    fireResize([makeEntry(50)]);
    expect(onHeight).not.toHaveBeenCalled();

    fireResize([makeEntry(30)]);
    expect(onHeight).not.toHaveBeenCalled();

    fireResize([makeEntry(51)]);
    expect(onHeight).toHaveBeenCalledWith(51);
  });

  it('should short-circuit when observing the same element', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight);
    const el = document.createElement('div');
    const spy = jest.spyOn(MockResizeObserver.prototype, 'observe');

    observer.observe(el);
    const callsAfterFirst = spy.mock.calls.length;

    observer.observe(el);
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
    spy.mockRestore();
  });

  it('should reset lastHeight when observing a new element', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight, 50);
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');

    observer.observe(el1);
    fireResize([makeEntry(200)]);
    expect(onHeight).toHaveBeenCalledWith(200);
    onHeight.mockClear();

    observer.observe(el2);
    // Height 201 would be within hysteresis of 200 if lastHeight wasn't
    // reset, but should fire because lastHeight is now 0.
    fireResize([makeEntry(201)]);
    expect(onHeight).toHaveBeenCalledWith(201);
  });

  it('should allow re-observing after unobserve()', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight);
    const el = document.createElement('div');

    observer.observe(el);
    fireResize([makeEntry(100)]);
    expect(onHeight).toHaveBeenCalledWith(100);

    observer.unobserve();

    onHeight.mockClear();
    observer.observe(el);
    fireResize([makeEntry(100)]);
    expect(onHeight).toHaveBeenCalledWith(100);
  });

  it('should create a fresh internal observer after disconnect()', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight);
    const el = document.createElement('div');

    observer.observe(el);
    observer.disconnect();

    const el2 = document.createElement('div');
    observer.observe(el2);
    fireResize([makeEntry(300)]);
    expect(onHeight).toHaveBeenCalledWith(300);
  });

  it('should handle empty entries gracefully', () => {
    const onHeight = jest.fn();
    const observer = new ResizeHeightObserver(onHeight);
    const el = document.createElement('div');

    observer.observe(el);
    fireResize([]);
    expect(onHeight).not.toHaveBeenCalled();
  });
});

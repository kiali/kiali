import * as React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';

jest.mock('components/DefaultSecondaryMasthead/DefaultSecondaryMasthead', () => ({
  // eslint-disable-next-line react/display-name
  DefaultSecondaryMasthead: () => <div data-test="DefaultSecondaryMasthead" />
}));

// VirtualList is a connected component; import after mocks
// eslint-disable-next-line import/first
import { VirtualList } from '../VirtualList';

describe('VirtualList', () => {
  let resizeCallback: (() => void) | undefined;
  let observedElement: Element | undefined;

  beforeEach(() => {
    resizeCallback = undefined;
    observedElement = undefined;

    (window as any).ResizeObserver = class {
      constructor(cb: () => void) {
        resizeCallback = cb;
      }
      observe(el: Element): void {
        observedElement = el;
      }
      disconnect(): void {
        resizeCallback = undefined;
        observedElement = undefined;
      }
    };
  });

  afterEach(() => {
    delete (window as any).ResizeObserver;
  });

  it('calls onResize with the outer div clientHeight on mount', () => {
    const onResize = jest.fn();

    const { container } = render(
      <Provider store={store}>
        <VirtualList type="services" rows={[]} onResize={onResize} />
      </Provider>
    );

    const outerDiv = container.firstElementChild as HTMLElement;

    expect(onResize).toHaveBeenCalledWith(outerDiv.clientHeight);
  });

  it('attaches ResizeObserver to its own outer div', () => {
    const { container } = render(
      <Provider store={store}>
        <VirtualList type="services" rows={[]} />
      </Provider>
    );

    const outerDiv = container.firstElementChild as HTMLElement;

    expect(observedElement).toBe(outerDiv);
  });

  it('calls onResize when ResizeObserver fires', () => {
    const onResize = jest.fn();

    render(
      <Provider store={store}>
        <VirtualList type="services" rows={[]} onResize={onResize} />
      </Provider>
    );

    onResize.mockClear();
    resizeCallback?.();

    expect(onResize).toHaveBeenCalledWith(expect.any(Number));
  });

  it('disconnects ResizeObserver on unmount', () => {
    const { unmount } = render(
      <Provider store={store}>
        <VirtualList type="services" rows={[]} />
      </Provider>
    );

    expect(resizeCallback).toBeDefined();
    unmount();
    expect(resizeCallback).toBeUndefined();
  });

  it('still calls onResize once on mount when ResizeObserver is unavailable', () => {
    delete (window as any).ResizeObserver;
    const onResize = jest.fn();

    render(
      <Provider store={store}>
        <VirtualList type="services" rows={[]} onResize={onResize} />
      </Provider>
    );

    expect(onResize).toHaveBeenCalledTimes(1);
    expect(observedElement).toBeUndefined();
  });

  it('falls back to window resize listener when ResizeObserver is unavailable', () => {
    delete (window as any).ResizeObserver;
    const onResize = jest.fn();
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <Provider store={store}>
        <VirtualList type="services" rows={[]} onResize={onResize} />
      </Provider>
    );

    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    onResize.mockClear();
    window.dispatchEvent(new Event('resize'));
    expect(onResize).toHaveBeenCalled();

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

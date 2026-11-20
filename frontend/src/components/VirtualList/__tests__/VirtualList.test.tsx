import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import type { NamespaceInfo } from 'types/NamespaceInfo';
import { store } from 'store/ConfigStore';

rstest.mock('components/Link/KialiLink', () => ({
  KialiLink: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));

rstest.mock('components/DefaultSecondaryMasthead/DefaultSecondaryMasthead', () => ({
  DefaultSecondaryMasthead: () => <div data-test="DefaultSecondaryMasthead" />
}));

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

  it('explains label filtering in the Labels column header', async () => {
    const { container } = render(
      <Provider store={store}>
        <VirtualList type="services" rows={[]} />
      </Provider>
    );
    const header = container.querySelector('th[data-label="Labels"]') as HTMLElement;

    fireEvent.click(within(header).getByRole('button', { name: 'More info' }));

    expect(await screen.findByTestId('labels-filter-help')).toHaveTextContent(
      'Click a label to add or remove its filter. Labels matched by a filter expression must be changed using the filter controls.'
    );
  });

  it.each(['reordering', 'filtering'])('preserves row label expansion after %s', change => {
    const first: NamespaceInfo = {
      cluster: 'east',
      labels: { 'istio.io/custom': 'first', app: 'first', zzz: 'hidden-first' },
      name: 'first'
    };
    const second: NamespaceInfo = {
      cluster: 'east',
      labels: { 'istio.io/custom': 'second', app: 'second', zzz: 'hidden-second' },
      name: 'second'
    };
    const renderRows = (rows: NamespaceInfo[]): JSX.Element => (
      <Provider store={store}>
        <VirtualList type="namespaces" rows={rows} />
      </Provider>
    );
    const { rerender } = render(renderRows([first, second]));
    const secondRow = within(screen.getByTestId('VirtualItem_Clustereast_second'));
    fireEvent.click(secondRow.getByTestId('toggle-labels'));
    expect(secondRow.getByText('zzz=hidden-second')).toBeInTheDocument();

    rerender(renderRows(change === 'reordering' ? [second, first] : [second]));

    const movedRow = within(screen.getByTestId('VirtualItem_Clustereast_second'));
    expect(movedRow.getByText('zzz=hidden-second')).toBeInTheDocument();
    expect(movedRow.getByTestId('toggle-labels')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('zzz=hidden-first')).not.toBeInTheDocument();
  });

  it('calls onResize with the outer div clientHeight on mount', () => {
    const onResize = rstest.fn();

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
    const onResize = rstest.fn();

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
    const onResize = rstest.fn();

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
    const onResize = rstest.fn();
    const addSpy = rstest.spyOn(window, 'addEventListener');
    const removeSpy = rstest.spyOn(window, 'removeEventListener');

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

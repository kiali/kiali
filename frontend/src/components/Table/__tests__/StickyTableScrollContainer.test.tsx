import { fireEvent, render } from '@testing-library/react';
import { StickyTableScrollContainer, TABLE_SCROLLED } from '../StickyTableScrollContainer';

describe('StickyTableScrollContainer', () => {
  it('adds TABLE_SCROLLED when scrolled', () => {
    const { container } = render(
      <StickyTableScrollContainer>
        <div style={{ height: '200px' }} />
      </StickyTableScrollContainer>
    );

    const scrollContainer = container.firstElementChild as HTMLElement;
    Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 10, writable: true });

    fireEvent.scroll(scrollContainer);

    expect(scrollContainer.className).toContain(TABLE_SCROLLED);
  });

  it('removes TABLE_SCROLLED when scrolled back to top', () => {
    const { container } = render(
      <StickyTableScrollContainer>
        <div style={{ height: '200px' }} />
      </StickyTableScrollContainer>
    );

    const scrollContainer = container.firstElementChild as HTMLElement;
    Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 10, writable: true });
    fireEvent.scroll(scrollContainer);
    Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 0, writable: true });
    fireEvent.scroll(scrollContainer);

    expect(scrollContainer.className).not.toContain(TABLE_SCROLLED);
  });

  it('re-syncs scroll state when contentVersion changes', () => {
    const { container, rerender } = render(
      <StickyTableScrollContainer contentVersion={[]}>
        <div style={{ height: '200px' }} />
      </StickyTableScrollContainer>
    );

    const scrollContainer = container.firstElementChild as HTMLElement;
    Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 10, writable: true });
    fireEvent.scroll(scrollContainer);
    expect(scrollContainer.className).toContain(TABLE_SCROLLED);

    rerender(
      <StickyTableScrollContainer contentVersion={[{ cells: ['row'] }]}>
        <div style={{ height: '200px' }} />
      </StickyTableScrollContainer>
    );

    expect(scrollContainer.className).toContain(TABLE_SCROLLED);
  });
});

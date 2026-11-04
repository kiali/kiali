import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import type { SliderOnChangeEvent } from '@patternfly/react-core';
import { Slider } from '../Slider';

const pfSliderOnChange = rstest.fn();

let pfSliderMountSeq = 0;

const getPfSliderMountId = (): string | null =>
  document.querySelector('[data-test="pf-slider-mock"]')?.getAttribute('data-mount-id') ?? null;

rstest.mock('@patternfly/react-core', () => {
  const actual = rstest.requireActual('@patternfly/react-core');
  return {
    ...actual,
    Slider: ({
      onChange,
      value,
      id
    }: {
      id?: string;
      onChange?: (event: SliderOnChangeEvent, value: number) => void;
      value: number;
    }) => {
      const mountId = React.useMemo(() => ++pfSliderMountSeq, []);

      return (
        <div data-test="pf-slider-mock" data-mount-id={String(mountId)} id={id}>
          <div className="pf-v6-c-slider">
            <button type="button" className="pf-v6-c-slider__thumb" tabIndex={0} data-test="pf-slider-thumb" />
            <button
              type="button"
              data-test="pf-slider-change"
              onClick={() => onChange?.({} as SliderOnChangeEvent, 80)}
            >
              {value}
            </button>
          </div>
        </div>
      );
    },
    Tooltip: ({ content }: { content?: React.ReactNode }) => <div data-test="pf-tooltip">{content}</div>
  };
});

describe('Slider', () => {
  beforeEach(() => {
    pfSliderMountSeq = 0;
    pfSliderOnChange.mockClear();
  });

  it('passes capped value to onChange when valueCap is set', () => {
    render(
      <Slider min={0} max={100} value={20} valueCap={40} onChange={pfSliderOnChange} onValueCommit={rstest.fn()} />
    );

    fireEvent.click(document.querySelector('[data-test="pf-slider-change"]')!);

    expect(pfSliderOnChange).toHaveBeenCalledWith(expect.anything(), 40);
  });

  it('does not pass a value below min to PatternFly Slider', () => {
    render(<Slider min={0} max={100} value={-5} valueCap={100} onChange={pfSliderOnChange} />);

    expect(document.querySelector('[data-test="pf-slider-change"]')?.textContent).toBe('0');
  });

  it('calls onValueCommit on pointer release after interaction', () => {
    const onValueCommit = rstest.fn();

    const { container } = render(
      <Slider min={0} max={100} value={20} onChange={pfSliderOnChange} onValueCommit={onValueCommit} />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.pointerDown(wrapper);
    fireEvent.click(document.querySelector('[data-test="pf-slider-change"]')!);
    fireEvent.pointerUp(window);

    expect(onValueCommit).toHaveBeenCalledWith(80);
  });

  it('calls onValueCommit on rail click after pointerup when onChange runs last', () => {
    const onValueCommit = rstest.fn();

    const { container } = render(
      <Slider min={0} max={100} value={20} onChange={pfSliderOnChange} onValueCommit={onValueCommit} />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.pointerDown(wrapper);
    fireEvent.pointerUp(window);
    fireEvent.click(document.querySelector('[data-test="pf-slider-change"]')!);

    expect(onValueCommit).toHaveBeenCalledWith(80);
  });

  it('defers PatternFly remount until pointerup when valueCap clamps during drag', () => {
    const { container } = render(<Slider min={0} max={100} value={20} valueCap={40} onChange={pfSliderOnChange} />);

    const mountIdBefore = getPfSliderMountId();
    const wrapper = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(wrapper);
    fireEvent.click(document.querySelector('[data-test="pf-slider-change"]')!);

    expect(getPfSliderMountId()).toBe(mountIdBefore);

    fireEvent.pointerUp(window);

    expect(getPfSliderMountId()).not.toBe(mountIdBefore);
  });

  it('flushes deferred PatternFly remount on pointercancel', () => {
    const { container } = render(<Slider min={0} max={100} value={20} valueCap={40} onChange={pfSliderOnChange} />);

    const mountIdBefore = getPfSliderMountId();
    const wrapper = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(wrapper);
    fireEvent.click(document.querySelector('[data-test="pf-slider-change"]')!);

    expect(getPfSliderMountId()).toBe(mountIdBefore);

    fireEvent.pointerCancel(window);

    expect(getPfSliderMountId()).not.toBe(mountIdBefore);
  });

  it('does not commit on pointercancel and does not commit on a later pointerup', () => {
    const onValueCommit = rstest.fn();

    const { container } = render(
      <Slider min={0} max={100} value={20} onChange={pfSliderOnChange} onValueCommit={onValueCommit} />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.pointerDown(wrapper);
    fireEvent.click(document.querySelector('[data-test="pf-slider-change"]')!);
    fireEvent.pointerCancel(window);

    expect(onValueCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(window);

    expect(onValueCommit).not.toHaveBeenCalled();
  });

  it('blurs focused thumb on another slider when pointerdown starts on this slider', () => {
    const { container } = render(
      <>
        <Slider id="slider-a" min={0} max={100} value={10} onChange={pfSliderOnChange} />
        <Slider id="slider-b" min={0} max={100} value={20} onChange={pfSliderOnChange} />
      </>
    );

    const thumbs = document.querySelectorAll('[data-test="pf-slider-thumb"]');
    const thumbA = thumbs[0] as HTMLButtonElement;
    thumbA.focus();
    expect(document.activeElement).toBe(thumbA);

    const wrapperB = container.querySelectorAll('[data-test="pf-slider-mock"]')[1]?.parentElement as HTMLElement;
    fireEvent.pointerDown(wrapperB);

    expect(document.activeElement).not.toBe(thumbA);
  });

  it('renders data-test when dataTest is set', () => {
    const { container } = render(
      <Slider dataTest="replay-slider" min={0} max={10} value={1} onChange={pfSliderOnChange} />
    );

    expect(container.querySelector('[data-test="replay-slider"]')).toBeTruthy();
  });

  it('does not call onValueCommit on unrelated keyUp', () => {
    const onValueCommit = rstest.fn();

    const { container } = render(
      <Slider min={0} max={100} value={20} onChange={pfSliderOnChange} onValueCommit={onValueCommit} />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.keyUp(wrapper, { key: 'Tab' });

    expect(onValueCommit).not.toHaveBeenCalled();
  });

  it('calls onValueCommit on slider adjustment keys', () => {
    const onValueCommit = rstest.fn();

    const { container } = render(
      <Slider min={0} max={100} value={20} onChange={pfSliderOnChange} onValueCommit={onValueCommit} />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.keyUp(wrapper, { key: 'ArrowRight' });

    expect(onValueCommit).toHaveBeenCalledWith(20);
  });

  it('does not call onValueCommit when disabled', () => {
    const onValueCommit = rstest.fn();

    const { container } = render(
      <Slider isDisabled min={0} max={100} value={20} onChange={pfSliderOnChange} onValueCommit={onValueCommit} />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.keyUp(wrapper, { key: 'ArrowRight' });

    expect(onValueCommit).not.toHaveBeenCalled();
  });
});

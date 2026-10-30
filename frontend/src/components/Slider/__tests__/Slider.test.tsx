import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import type { SliderOnChangeEvent } from '@patternfly/react-core';
import { Slider } from '../Slider';

const pfSliderOnChange = rstest.fn();

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
    }) => (
      <div data-test="pf-slider-mock" id={id}>
        <button type="button" data-test="pf-slider-change" onClick={() => onChange?.({} as SliderOnChangeEvent, 80)}>
          {value}
        </button>
      </div>
    ),
    Tooltip: ({ content }: { content?: React.ReactNode }) => <div data-test="pf-tooltip">{content}</div>
  };
});

describe('Slider', () => {
  beforeEach(() => {
    pfSliderOnChange.mockClear();
  });

  it('passes capped value to onChange when valueCap is set', () => {
    render(
      <Slider min={0} max={100} value={20} valueCap={40} onChange={pfSliderOnChange} onValueCommit={rstest.fn()} />
    );

    fireEvent.click(document.querySelector('[data-test="pf-slider-change"]')!);

    expect(pfSliderOnChange).toHaveBeenCalledWith(expect.anything(), 40);
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

  it('renders data-test when dataTest is set', () => {
    const { container } = render(
      <Slider dataTest="replay-slider" min={0} max={10} value={1} onChange={pfSliderOnChange} />
    );

    expect(container.querySelector('[data-test="replay-slider"]')).toBeTruthy();
  });
});

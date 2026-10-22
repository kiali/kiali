import * as React from 'react';
import type { SliderOnChangeEvent } from '@patternfly/react-core';
import { Slider as PFSlider } from '@patternfly/react-core';
import { classes } from 'typestyle';
import { sliderStyle } from './SliderStyle';

export type SliderProps = {
  className?: string;
  endActions?: React.ReactNode;
  hasTooltipOverThumb?: boolean;
  id?: string;
  isDisabled?: boolean;
  max: number;
  maxRailWidth?: string;
  min: number;
  onChange: (event: SliderOnChangeEvent, value: number) => void;
  onValueCommit?: (value: number) => void;
  railTrackFill?: string;
  showBoundaries?: boolean;
  showTicks?: boolean;
  step?: number;
  tooltipContent?: React.ReactNode;
  value: number;
};

export const Slider: React.FC<SliderProps> = ({
  className,
  endActions,
  hasTooltipOverThumb,
  id,
  isDisabled,
  max,
  maxRailWidth,
  min,
  railTrackFill,
  onChange,
  onValueCommit,
  showBoundaries,
  showTicks,
  step,
  tooltipContent,
  value
}) => {
  const latestValueRef = React.useRef(value);

  React.useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const handleChange = (event: SliderOnChangeEvent, newValue: number): void => {
    latestValueRef.current = newValue;
    onChange(event, newValue);
  };

  const handleRelease = (): void => {
    onValueCommit?.(latestValueRef.current);
  };

  return (
    <div
      className={classes(sliderStyle(maxRailWidth, railTrackFill), className)}
      onMouseUp={onValueCommit ? handleRelease : undefined}
      onTouchEnd={onValueCommit ? handleRelease : undefined}
    >
      <PFSlider
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        isDisabled={isDisabled}
        showTicks={showTicks}
        showBoundaries={showBoundaries}
        hasTooltipOverThumb={hasTooltipOverThumb}
        tooltipContent={tooltipContent}
        onChange={handleChange}
        endActions={endActions}
      />
    </div>
  );
};

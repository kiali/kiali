import * as React from 'react';
import type { SliderOnChangeEvent } from '@patternfly/react-core';
import {
  Button,
  ButtonVariant,
  InputGroup,
  InputGroupItem,
  InputGroupText,
  Slider as PFSlider,
  TextInput,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { MigrationIcon, LockIcon as PFLockIcon, LockOpenIcon } from '@patternfly/react-icons';
import { classes } from 'typestyle';
import { sliderMirroredStyle, sliderReplayStyle, sliderStyle } from './SliderStyle';
import { kialiStyle } from 'styles/StyleUtils';

export const noop = Function.prototype;

type SliderProps = {
  id: string;
  input: boolean;
  inputFormat?: string;
  locked: boolean;
  max: number;
  maxLimit: number;
  maxWidth?: string;
  min: number;
  mirrored: boolean;
  onLock?: (locked: boolean) => void;
  onMirror?: (mirror: boolean) => void;
  onSlide?: (value: number) => void;
  onSlideStop?: (value: number) => void;
  orientation?: string;
  replayAccent?: boolean;
  showLock: boolean;
  showMirror?: boolean;
  sliderClass?: string;
  step?: number;
  ticks?: number[];
  ticks_labels?: string[];
  tooltip?: boolean;
  tooltipFormatter?: (value: number) => string;
  value: number;
};

const lockButtonStyle = kialiStyle({
  paddingLeft: '8px',
  paddingRight: '8px'
});

const inputStyle = kialiStyle({
  textAlign: 'center',
  width: '3.5rem'
});

const inputGroupStyle = kialiStyle({
  paddingRight: '4px',
  width: 'fit-content'
});

export const Slider: React.FC<SliderProps> = ({
  id,
  input,
  inputFormat = '',
  locked,
  max,
  maxLimit,
  maxWidth,
  min,
  mirrored,
  onLock = noop,
  onMirror = noop,
  onSlide = noop,
  onSlideStop = noop,
  replayAccent = false,
  showLock,
  showMirror = false,
  step = 1,
  ticks,
  tooltip = false,
  tooltipFormatter,
  value
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  const [tooltipValue, setTooltipValue] = React.useState(value);
  const latestValue = React.useRef(value);

  React.useEffect(() => {
    setLocalValue(value);
    setTooltipValue(value);
    latestValue.current = value;
  }, [value]);

  const clamp = (v: number): number => Math.max(min, Math.min(max, v));

  const handleChange = (
    _event: SliderOnChangeEvent,
    sliderValue: number,
    typedInputValue?: number,
    setLocalInputValue?: React.Dispatch<React.SetStateAction<number>>
  ): void => {
    let newValue: number;
    if (typedInputValue !== undefined) {
      if (typedInputValue > max) {
        newValue = max;
        setLocalInputValue?.(max);
      } else if (typedInputValue < min) {
        newValue = min;
        setLocalInputValue?.(min);
      } else if (Number.isNaN(typedInputValue)) {
        newValue = min;
        setLocalInputValue?.(min);
      } else {
        newValue = typedInputValue;
      }
    } else {
      newValue = clamp(sliderValue);
    }
    setLocalValue(newValue);
    setTooltipValue(newValue);
    latestValue.current = newValue;
    onSlide(newValue);
  };

  const handleRelease = (): void => {
    onSlideStop(latestValue.current);
  };

  const handleInputChange = (_event: React.FormEvent<HTMLInputElement>, val: string | number): void => {
    const newValue = clamp(Number(val) || 0);
    setLocalValue(newValue);
    setTooltipValue(newValue);
    latestValue.current = newValue;
    onSlide(newValue);
  };

  const handleInputBlur = (): void => {
    onSlideStop(latestValue.current);
  };

  const tooltipContent =
    tooltipFormatter && tooltipFormatter !== noop
      ? tooltipFormatter(tooltipValue)
      : `${tooltipValue} ${inputFormat}${mirrored ? ' mirrored traffic' : ''}`;

  const lockAction = showLock ? (
    <Tooltip position={TooltipPosition.top} content={<>{locked ? 'Unlock' : 'Lock'} Weight for this Workload</>}>
      <Button
        icon={locked ? <PFLockIcon /> : <LockOpenIcon />}
        className={lockButtonStyle}
        isDisabled={mirrored}
        variant={ButtonVariant.plain}
        onClick={() => onLock(!locked)}
      />
    </Tooltip>
  ) : null;

  const mirrorAction = showMirror ? (
    <Tooltip
      position={TooltipPosition.top}
      content={<>{mirrored ? 'Cancel mirroring traffic to this workload' : 'Mirror traffic to this workload'}</>}
    >
      <Button
        icon={<MigrationIcon />}
        className={lockButtonStyle}
        variant={ButtonVariant.plain}
        onClick={() => onMirror(!mirrored)}
      />
    </Tooltip>
  ) : null;

  const inputAction = input ? (
    <InputGroup className={inputGroupStyle}>
      <InputGroupItem>
        <TextInput
          className={inputStyle}
          id="slider-text"
          aria-label="slider-text"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          isDisabled={locked}
          data-test={`input-${id}`}
        />
      </InputGroupItem>
      {inputFormat ? <InputGroupText>{inputFormat}</InputGroupText> : null}
    </InputGroup>
  ) : null;

  const showTicks = Boolean(ticks && ticks.length > 0);

  return (
    <div
      className={classes(sliderStyle(maxWidth), mirrored && sliderMirroredStyle, replayAccent && sliderReplayStyle)}
      onMouseUp={handleRelease}
      onTouchEnd={handleRelease}
    >
      <PFSlider
        id={id}
        min={min}
        max={maxLimit}
        step={step}
        value={localValue}
        isDisabled={locked}
        showTicks={showTicks}
        showBoundaries={false}
        hasTooltipOverThumb={tooltip}
        tooltipContent={tooltip ? tooltipContent : undefined}
        onChange={handleChange}
        endActions={
          <>
            {inputAction}
            {mirrorAction}
            {lockAction}
          </>
        }
      />
    </div>
  );
};

import * as React from 'react';
import type { SliderOnChangeEvent } from '@patternfly/react-core';
import {
  Button,
  ButtonVariant,
  InputGroup,
  InputGroupItem,
  InputGroupText,
  TextInput,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { MigrationIcon, LockIcon as PFLockIcon, LockOpenIcon } from '@patternfly/react-icons';
import { classes } from 'typestyle';
import { Slider } from './Slider';
import { sliderMirroredStyle, sliderReplayStyle } from './SliderStyle';
import { kialiStyle } from 'styles/StyleUtils';

export const noop = Function.prototype;

type RoutingSliderProps = {
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

export const RoutingSlider: React.FC<RoutingSliderProps> = ({
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

  React.useEffect(() => {
    setLocalValue(value);
    setTooltipValue(value);
  }, [value]);

  const clamp = (v: number): number => Math.max(min, Math.min(max, v));

  const handleChange = (_event: SliderOnChangeEvent, sliderValue: number): void => {
    const newValue = clamp(sliderValue);
    setLocalValue(newValue);
    setTooltipValue(newValue);
    onSlide(newValue);
  };

  const handleInputChange = (_event: React.FormEvent<HTMLInputElement>, val: string | number): void => {
    const newValue = clamp(Number(val) || 0);
    setLocalValue(newValue);
    setTooltipValue(newValue);
    onSlide(newValue);
  };

  const handleInputBlur = (): void => {
    onSlideStop(localValue);
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
    <Slider
      id={id}
      className={classes(mirrored && sliderMirroredStyle, replayAccent && sliderReplayStyle)}
      min={min}
      max={maxLimit}
      maxRailWidth={maxWidth}
      step={step}
      value={localValue}
      isDisabled={locked}
      showTicks={showTicks}
      showBoundaries={false}
      hasTooltipOverThumb={tooltip}
      tooltipContent={tooltip ? tooltipContent : undefined}
      onChange={handleChange}
      onValueCommit={value => onSlideStop(value)}
      endActions={
        <>
          {inputAction}
          {mirrorAction}
          {lockAction}
        </>
      }
    />
  );
};

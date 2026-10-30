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
import { Slider } from './Slider';
import { PFColors } from 'components/Pf/PfColors';
import { sliderMirroredStyle } from './SliderStyle';
import { PFSpacer } from 'styles/PfSpacer';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

const noop = Function.prototype;

export type RoutingSliderProps = {
  id: string;
  input: boolean;
  inputFormat?: string;
  locked: boolean;
  max: number;
  maxLimit: number;
  maxRailWidth?: string;
  min: number;
  mirrored: boolean;
  onLock?: (locked: boolean) => void;
  onMirror?: (mirror: boolean) => void;
  onSlide?: (value: number) => void;
  onSlideStop?: (value: number) => void;
  showLock: boolean;
  showMirror?: boolean;
  step?: number;
  tooltip?: boolean;
  value: number;
};

const lockButtonStyle = kialiStyle({
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem'
});

const inputStyle = kialiStyle({
  textAlign: 'center',
  width: '3.5rem'
});

const inputGroupStyle = kialiStyle({
  marginLeft: PFSpacer.sm,
  paddingRight: '0.25rem',
  width: 'fit-content'
});

const endActionsStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

export const RoutingSlider: React.FC<RoutingSliderProps> = ({
  id,
  input,
  inputFormat = '',
  locked,
  max,
  maxLimit,
  maxRailWidth,
  min,
  mirrored,
  onLock = noop,
  onMirror = noop,
  onSlide = noop,
  onSlideStop = noop,
  showLock,
  showMirror = false,
  step = 1,
  tooltip = true,
  value
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  const [tooltipValue, setTooltipValue] = React.useState(value);

  React.useEffect(() => {
    const effectiveMax = Math.min(max, maxLimit);
    const clamped = Math.max(min, Math.min(effectiveMax, value));
    setLocalValue(clamped);
    setTooltipValue(clamped);
  }, [value, max, maxLimit, min]);

  const effectiveMax = Math.min(max, maxLimit);

  const clamp = (v: number): number => Math.max(min, Math.min(effectiveMax, v));

  const handleChange = (_event: SliderOnChangeEvent, sliderValue: number): void => {
    const newValue = sliderValue >= effectiveMax ? effectiveMax : clamp(sliderValue);
    setLocalValue(newValue);
    setTooltipValue(newValue);
    onSlide(newValue);
  };

  const handleInputChange = (_event: React.FormEvent<HTMLInputElement>, val: string | number): void => {
    if (typeof val === 'string' && val.trim() === '') {
      return;
    }
    const parsed = Number(val);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const newValue = clamp(parsed);
    setLocalValue(newValue);
    setTooltipValue(newValue);
    onSlide(newValue);
  };

  const handleInputBlur = (): void => {
    if (locked) {
      return;
    }
    onSlideStop(localValue);
  };

  const handleLockClick = (event: React.MouseEvent): void => {
    event.stopPropagation();
    onLock(!locked);
  };

  const handleMirrorClick = (): void => {
    onMirror(!mirrored);
  };

  const thumbTooltipContent = mirrored
    ? t('{{value}} {{format}} mirrored traffic', { value: tooltipValue, format: inputFormat })
    : `${tooltipValue} ${inputFormat}`.trim();

  const lockTooltipContent = locked ? t('Unlock Weight for this Workload') : t('Lock Weight for this Workload');

  const lockAction = showLock ? (
    <Tooltip position={TooltipPosition.top} content={<>{lockTooltipContent}</>}>
      <Button
        icon={locked ? <PFLockIcon /> : <LockOpenIcon />}
        className={lockButtonStyle}
        isDisabled={mirrored}
        variant={ButtonVariant.plain}
        onClick={handleLockClick}
      />
    </Tooltip>
  ) : null;

  const mirrorAction = showMirror ? (
    <Tooltip
      position={TooltipPosition.top}
      content={<>{mirrored ? t('Cancel mirroring traffic to this workload') : t('Mirror traffic to this workload')}</>}
    >
      <Button
        icon={<MigrationIcon />}
        className={lockButtonStyle}
        variant={ButtonVariant.plain}
        onClick={handleMirrorClick}
      />
    </Tooltip>
  ) : null;

  const inputAction = input ? (
    <InputGroup className={inputGroupStyle}>
      <InputGroupItem>
        <TextInput
          className={inputStyle}
          id={`${id}-text`}
          aria-label={t('Traffic weight')}
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

  return (
    <Slider
      id={id}
      className={mirrored ? sliderMirroredStyle : undefined}
      min={min}
      max={maxLimit}
      maxRailWidth={maxRailWidth}
      railTrackFill={mirrored ? PFColors.Mirroring : undefined}
      step={step}
      value={localValue}
      valueCap={effectiveMax < maxLimit ? effectiveMax : undefined}
      isDisabled={locked}
      showBoundaries={false}
      hasTooltipOverThumb={tooltip}
      tooltipContent={tooltip ? thumbTooltipContent : undefined}
      onChange={handleChange}
      onValueCommit={committed => onSlideStop(committed)}
      endActions={
        <div
          className={endActionsStyle}
          onMouseDown={e => e.stopPropagation()}
          onMouseUp={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {inputAction}
          {mirrorAction}
          {lockAction}
        </div>
      }
    />
  );
};

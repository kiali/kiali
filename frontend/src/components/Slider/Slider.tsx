import * as React from 'react';
import type { SliderOnChangeEvent } from '@patternfly/react-core';
import { Slider as PFSlider, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { classes } from 'typestyle';
import { sliderRailFillCssVar, sliderStyle } from './SliderStyle';

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
  valueCap?: number;
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
  onChange,
  onValueCommit,
  railTrackFill,
  showBoundaries,
  showTicks,
  step,
  tooltipContent,
  value,
  valueCap
}) => {
  const latestValueRef = React.useRef(value);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const thumbTriggerRef = React.useRef<HTMLElement | null>(null);
  const [railHovered, setRailHovered] = React.useState(false);
  const [thumbTooltipReady, setThumbTooltipReady] = React.useState(false);

  const capValue = (v: number): number => {
    const capped = valueCap === undefined ? v : Math.min(valueCap, v);
    return Math.max(min, capped);
  };

  const displayValue = capValue(value);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onValueCommitRef = React.useRef(onValueCommit);
  onValueCommitRef.current = onValueCommit;

  const showRailTooltip = Boolean(hasTooltipOverThumb && tooltipContent);

  React.useLayoutEffect(() => {
    if (!showRailTooltip || !wrapperRef.current) {
      thumbTriggerRef.current = null;
      setRailHovered(false);
      setThumbTooltipReady(false);
      return;
    }

    const wrapper = wrapperRef.current;
    const main = wrapper.querySelector<HTMLElement>('.pf-v6-c-slider__main');
    const thumb = wrapper.querySelector<HTMLElement>('.pf-v6-c-slider__thumb');

    thumbTriggerRef.current = thumb ?? null;
    setThumbTooltipReady(thumb !== null && thumb !== undefined);

    if (!main) {
      return;
    }

    const onEnter = (): void => setRailHovered(true);
    const onLeave = (): void => setRailHovered(false);

    main.addEventListener('mouseenter', onEnter);
    main.addEventListener('mouseleave', onLeave);

    return () => {
      main.removeEventListener('mouseenter', onEnter);
      main.removeEventListener('mouseleave', onLeave);
    };
  }, [showRailTooltip, id, value]);

  const applyThumbPosition = React.useCallback(
    (valueForPosition: number): void => {
      const sliderRoot = wrapperRef.current?.querySelector<HTMLElement>('.pf-v6-c-slider');
      if (!sliderRoot || max <= min) {
        return;
      }

      const percent = `${((valueForPosition - min) / (max - min)) * 100}%`;
      sliderRoot.style.setProperty('--pf-v6-c-slider--value', percent);

      const thumb = sliderRoot.querySelector<HTMLElement>('.pf-v6-c-slider__thumb');
      thumb?.style.setProperty('--pf-v6-c-slider--value', percent);
    },
    [max, min]
  );

  const syncSliderThumbPosition = React.useCallback((): void => {
    applyThumbPosition(displayValue);
  }, [applyThumbPosition, displayValue]);

  React.useLayoutEffect(() => {
    const sliderRoot = wrapperRef.current?.querySelector<HTMLElement>('.pf-v6-c-slider');
    if (!sliderRoot) {
      return;
    }

    if (railTrackFill) {
      sliderRoot.style.setProperty(sliderRailFillCssVar, railTrackFill);
    } else {
      sliderRoot.style.removeProperty(sliderRailFillCssVar);
    }

    syncSliderThumbPosition();
  }, [displayValue, max, min, railTrackFill, id, value, syncSliderThumbPosition]);

  React.useEffect(() => {
    latestValueRef.current = displayValue;
  }, [displayValue]);

  const handleChange = (event: SliderOnChangeEvent, newValue: number): void => {
    if (isDisabled) {
      return;
    }
    const capped = valueCap !== undefined && newValue >= valueCap ? valueCap : capValue(newValue);
    latestValueRef.current = capped;
    onChange(event, capped);
    if (capped !== newValue) {
      applyThumbPosition(capped);
      requestAnimationFrame(() => applyThumbPosition(capped));
    }
  };

  const handleRelease = (): void => {
    if (isDisabled) {
      return;
    }
    onValueCommit?.(latestValueRef.current);
  };

  return (
    <div
      ref={wrapperRef}
      className={classes(sliderStyle(maxRailWidth, railTrackFill), className)}
      onMouseUp={onValueCommit ? handleRelease : undefined}
      onTouchEnd={onValueCommit ? handleRelease : undefined}
    >
      {showRailTooltip && thumbTooltipReady ? (
        <Tooltip
          triggerRef={thumbTriggerRef}
          trigger="manual"
          isVisible={railHovered}
          position={TooltipPosition.top}
          content={tooltipContent}
          entryDelay={0}
          exitDelay={0}
        />
      ) : null}
      <PFSlider
        id={id}
        min={min}
        max={max}
        step={step}
        value={displayValue}
        isDisabled={isDisabled}
        showTicks={showTicks}
        showBoundaries={showBoundaries ?? false}
        hasTooltipOverThumb={showRailTooltip ? false : hasTooltipOverThumb}
        tooltipContent={showRailTooltip ? undefined : tooltipContent}
        onChange={handleChange}
        endActions={endActions}
      />
    </div>
  );
};

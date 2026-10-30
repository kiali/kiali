import * as React from 'react';
import type { SliderOnChangeEvent } from '@patternfly/react-core';
import { Slider as PFSlider, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { classes } from 'typestyle';
import { capSliderValue } from './sliderValue';
import { sliderRailFillCssVar, sliderStyle } from './SliderStyle';

const SLIDER_COMMIT_KEYS = new Set(['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home']);

export type SliderProps = {
  className?: string;
  dataTest?: string;
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
  dataTest,
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
  const commitListenerRef = React.useRef<(() => void) | null>(null);
  const [railHovered, setRailHovered] = React.useState(false);
  const [thumbTooltipReady, setThumbTooltipReady] = React.useState(false);

  const displayValue = capSliderValue(value, min, valueCap);

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
  }, [showRailTooltip, id]);

  React.useLayoutEffect(() => {
    if (!showRailTooltip || !wrapperRef.current) {
      return;
    }

    const thumb = wrapperRef.current.querySelector<HTMLElement>('.pf-v6-c-slider__thumb');
    thumbTriggerRef.current = thumb ?? null;
    setThumbTooltipReady(thumb !== null && thumb !== undefined);
  }, [showRailTooltip, id, displayValue]);

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
    // PatternFly overrides rail fill in some themes; set the CSS variable on the slider root directly.
    const applyRailFillAndThumb = (): void => {
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
    };

    applyRailFillAndThumb();
    const rafId = requestAnimationFrame(applyRailFillAndThumb);

    return () => cancelAnimationFrame(rafId);
  }, [displayValue, max, min, railTrackFill, id, value, syncSliderThumbPosition]);

  React.useEffect(() => {
    latestValueRef.current = displayValue;
  }, [displayValue]);

  React.useEffect(() => {
    return () => {
      if (commitListenerRef.current) {
        commitListenerRef.current();
        commitListenerRef.current = null;
      }
    };
  }, []);

  const handleRelease = (): void => {
    if (isDisabled) {
      return;
    }
    onValueCommitRef.current?.(latestValueRef.current);
  };

  const clearCommitListener = (): void => {
    if (commitListenerRef.current) {
      commitListenerRef.current();
      commitListenerRef.current = null;
    }
  };

  const registerCommitOnPointerUp = (): void => {
    if (!onValueCommit || isDisabled || commitListenerRef.current) {
      return;
    }

    const onUp = (): void => {
      clearCommitListener();
      handleRelease();
    };

    const onPointerUp = (): void => onUp();
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('touchend', onPointerUp, true);

    commitListenerRef.current = (): void => {
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('touchend', onPointerUp, true);
    };
  };

  const handleWrapperPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!onValueCommit || isDisabled) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }

    registerCommitOnPointerUp();
  };

  const handleChange = (event: SliderOnChangeEvent, newValue: number): void => {
    if (isDisabled) {
      return;
    }
    const capped = valueCap !== undefined && newValue >= valueCap ? valueCap : capSliderValue(newValue, min, valueCap);
    latestValueRef.current = capped;
    onChange(event, capped);
    registerCommitOnPointerUp();
    if (capped !== newValue) {
      applyThumbPosition(capped);
      requestAnimationFrame(() => applyThumbPosition(capped));
    }
  };

  const handleWrapperKeyUp = (event: React.KeyboardEvent): void => {
    if (!onValueCommit || isDisabled || !SLIDER_COMMIT_KEYS.has(event.key)) {
      return;
    }
    handleRelease();
  };

  return (
    <div
      ref={wrapperRef}
      data-test={dataTest}
      className={classes(sliderStyle(maxRailWidth), className)}
      onPointerDown={onValueCommit ? handleWrapperPointerDown : undefined}
      onKeyUp={onValueCommit ? handleWrapperKeyUp : undefined}
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

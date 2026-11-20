import * as React from 'react';
import type { SliderOnChangeEvent } from '@patternfly/react-core';
import { Slider as PFSlider, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { classes } from 'typestyle';
import { sliderRailFillCssVar, sliderStyle } from './SliderStyle';

const capSliderValue = (value: number, min: number, valueCap?: number): number => {
  const capped = valueCap === undefined ? value : Math.min(valueCap, value);
  return Math.max(min, capped);
};

const SLIDER_COMMIT_KEYS = new Set(['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home']);

const blurFocusedThumbOnOtherSliders = (wrapper: HTMLElement): void => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.classList.contains('pf-v6-c-slider__thumb')) {
    return;
  }

  const focusedSlider = active.closest('.pf-v6-c-slider');
  const thisSlider = wrapper.querySelector('.pf-v6-c-slider');
  if (focusedSlider && thisSlider && focusedSlider !== thisSlider) {
    active.blur();
  }
};

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
  const pointerDownRef = React.useRef(false);
  const pendingPfRemountRef = React.useRef(false);
  const [pfValueKey, setPfValueKey] = React.useState(0);
  const [railHovered, setRailHovered] = React.useState(false);
  const [thumbTooltipReady, setThumbTooltipReady] = React.useState(false);

  const displayValue = capSliderValue(value, min, valueCap);

  const onValueCommitRef = React.useRef(onValueCommit);
  onValueCommitRef.current = onValueCommit;

  const showRailTooltip = Boolean(hasTooltipOverThumb && tooltipContent);

  const remountPfSlider = (): void => {
    setThumbTooltipReady(false);
    thumbTriggerRef.current = null;
    setPfValueKey(prev => prev + 1);
  };

  React.useEffect(() => {
    if (isDisabled) {
      setRailHovered(false);
    }
  }, [isDisabled]);

  React.useEffect(() => {
    if (!showRailTooltip) {
      return;
    }

    const onDocumentPointerDown = (event: PointerEvent): void => {
      const wrapper = wrapperRef.current;
      if (!wrapper) {
        return;
      }
      if (!wrapper.contains(event.target as Node)) {
        setRailHovered(false);
      }
    };

    document.addEventListener('pointerdown', onDocumentPointerDown, true);

    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  }, [showRailTooltip]);

  React.useLayoutEffect(() => {
    if (!showRailTooltip || !wrapperRef.current) {
      thumbTriggerRef.current = null;
      setRailHovered(false);
      setThumbTooltipReady(false);
      return;
    }

    const wrapper = wrapperRef.current;

    const handleMouseOver = (event: MouseEvent): void => {
      if (isDisabled) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.pf-v6-c-slider__main')) {
        return;
      }
      setRailHovered(true);
    };

    const handleMouseOut = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const main = target.closest('.pf-v6-c-slider__main');
      if (!main || !wrapper.contains(main)) {
        return;
      }
      const related = event.relatedTarget;
      if (related instanceof Node && main.contains(related)) {
        return;
      }
      setRailHovered(false);
    };

    wrapper.addEventListener('mouseover', handleMouseOver);
    wrapper.addEventListener('mouseout', handleMouseOut);

    return () => {
      wrapper.removeEventListener('mouseover', handleMouseOver);
      wrapper.removeEventListener('mouseout', handleMouseOut);
    };
  }, [showRailTooltip, id, isDisabled]);

  React.useLayoutEffect(() => {
    if (!showRailTooltip || !wrapperRef.current) {
      return;
    }

    const thumb = wrapperRef.current.querySelector<HTMLElement>('.pf-v6-c-slider__thumb');
    thumbTriggerRef.current = thumb ?? null;
    setThumbTooltipReady(thumb !== null && thumb !== undefined);
  }, [showRailTooltip, id, displayValue, pfValueKey]);

  React.useLayoutEffect(() => {
    if (!showRailTooltip || !thumbTooltipReady || !wrapperRef.current) {
      return;
    }

    const main = wrapperRef.current.querySelector<HTMLElement>('.pf-v6-c-slider__main');
    if (main?.matches(':hover')) {
      setRailHovered(true);
    }
  }, [pfValueKey, showRailTooltip, thumbTooltipReady]);

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

  const flushPendingPfRemount = (): void => {
    if (pendingPfRemountRef.current) {
      pendingPfRemountRef.current = false;
      remountPfSlider();
    }
  };

  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const onPointerDownCapture = (event: PointerEvent): void => {
      const target = event.target as HTMLElement;
      if (target.closest('button') || target.closest('input')) {
        return;
      }
      blurFocusedThumbOnOtherSliders(wrapper);
      pointerDownRef.current = true;
    };

    wrapper.addEventListener('pointerdown', onPointerDownCapture, true);

    return () => wrapper.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [id]);

  React.useEffect(() => {
    const clearPointerDown = (): void => {
      pointerDownRef.current = false;
      flushPendingPfRemount();
    };

    window.addEventListener('pointerup', clearPointerDown, true);
    window.addEventListener('touchend', clearPointerDown, true);
    window.addEventListener('pointercancel', clearPointerDown, true);

    return () => {
      window.removeEventListener('pointerup', clearPointerDown, true);
      window.removeEventListener('touchend', clearPointerDown, true);
      window.removeEventListener('pointercancel', clearPointerDown, true);
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
    const onPointerCancel = (): void => {
      clearCommitListener();
    };

    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('touchend', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);

    commitListenerRef.current = (): void => {
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('touchend', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
    };
  };

  const handleChange = (event: SliderOnChangeEvent, newValue: number): void => {
    if (isDisabled) {
      return;
    }
    const capped = valueCap !== undefined && newValue >= valueCap ? valueCap : capSliderValue(newValue, min, valueCap);
    latestValueRef.current = capped;
    onChange(event, capped);
    if (onValueCommit) {
      if (!pointerDownRef.current) {
        onValueCommitRef.current?.(capped);
      } else {
        registerCommitOnPointerUp();
      }
    }
    if (capped !== newValue) {
      applyThumbPosition(capped);
      requestAnimationFrame(() => applyThumbPosition(capped));
      if (pointerDownRef.current) {
        pendingPfRemountRef.current = true;
      } else {
        remountPfSlider();
      }
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
      onKeyUp={onValueCommit ? handleWrapperKeyUp : undefined}
    >
      {showRailTooltip && thumbTooltipReady ? (
        <Tooltip
          key={`${id ?? 'slider'}-${pfValueKey}`}
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
        key={pfValueKey}
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

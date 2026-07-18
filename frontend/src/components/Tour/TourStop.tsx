import * as React from 'react';
import { Button, ButtonVariant, Popover, PopoverPosition } from '@patternfly/react-core';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { KialiAppState } from 'store/Store';
import { useResizeDetector } from 'react-resize-detector';
import { TourActions } from 'actions/TourActions';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { t } from 'utils/I18nUtils';

export interface TourStopInfo {
  description?: string; // displayed as the tour stop body
  distance?: number; // distance from target, default=25
  htmlDescription?: React.ReactNode;
  isValid?: boolean; // internal use, leave unset
  name: string; // displayed in the tour stop header.
  position?: PopoverPosition;
}

export interface TourInfo {
  name: string;
  stops: Array<TourStopInfo>;
}

const stopNumberStyle = kialiStyle({
  borderRadius: '1rem',
  backgroundColor: PFColors.Blue300,
  display: 'inline-block',
  width: '1.5rem',
  textAlign: 'center',
  marginRight: '0.5rem',
  color: PFColors.White
});

type ReduxStateProps = {
  activeStop?: number;
  activeTour?: TourInfo;
};

type ReduxDispatchProps = {
  endTour: () => void;
  setStop: (stop: number) => void;
};

type TourStopProps = ReduxStateProps &
  ReduxDispatchProps & {
    children?: React.ReactNode;
    info: TourStopInfo | TourStopInfo[];
  };

const buttonsStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'space-between'
});

export function getNextTourStop(
  activeTour: TourInfo,
  activeStop: number,
  direction: 'back' | 'forward'
): number | undefined {
  if (direction === 'back') {
    for (let i: number = activeStop - 1; i >= 0; --i) {
      if (activeTour.stops[i].isValid) {
        return i;
      }
    }
  } else {
    for (let i: number = activeStop + 1; i < activeTour.stops.length; ++i) {
      if (activeTour.stops[i].isValid) {
        return i;
      }
    }
  }

  return undefined;
}

const TourStopComponent: React.FC<TourStopProps> = props => {
  const { activeStop, activeTour, children, endTour, info, setStop } = props;

  const [tourStopInfo] = React.useState<TourStopInfo[]>(() => (Array.isArray(info) ? info : [info]));

  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const activeInfo = (): TourStopInfo | undefined => {
    for (const tsi of tourStopInfo) {
      const name = tsi.name;
      const isActive = activeTour !== undefined && name === activeTour.stops[activeStop!].name;

      if (isActive) {
        return tsi;
      }
    }

    return undefined;
  };

  const getStop = (direction: 'back' | 'forward'): number | undefined => {
    if (activeStop === undefined) {
      return undefined;
    }

    return getNextTourStop(activeTour!, activeStop!, direction);
  };

  const setStopHandler = (stop: number): void => {
    setStop(stop);
  };

  const backButton = (): React.ReactNode => {
    const stop = getStop('back');

    return (
      <Button isDisabled={stop === undefined} variant={ButtonVariant.secondary} onClick={() => setStopHandler(stop!)}>
        {t('Back')}
      </Button>
    );
  };

  const nextButton = (): React.ReactNode => {
    const stop = getStop('forward');

    if (stop === undefined) {
      return (
        <Button variant={ButtonVariant.primary} onClick={endTour}>
          {t('Done')}
        </Button>
      );
    }

    return (
      <Button variant={ButtonVariant.primary} onClick={() => setStopHandler(stop!)}>
        {t('Next')}
      </Button>
    );
  };

  // This is here to workaround what seems to be a bug.  As far as I know when isVisible is set then outside clicks should not hide
  // the Popover, but it seems to be happening in certain scenarios. So, if the Popover is still valid, unhide it immediately.
  const onHidden = (): void => {
    if (activeInfo()) {
      forceUpdate();
    }
  };

  const onResize = (): void => {
    if (activeInfo()) {
      forceUpdate();
    }
  };

  const shouldClose = (): void => {
    endTour();
  };

  const bodyRef = React.useRef<HTMLElement>(document.body);

  useResizeDetector({
    targetRef: bodyRef,
    refreshMode: 'debounce',
    refreshRate: 100,
    skipOnMount: true,
    handleWidth: true,
    handleHeight: true,
    onResize
  });

  React.useEffect(() => {
    tourStopInfo.forEach(ti => (ti.isValid = true));

    return () => {
      tourStopInfo.forEach(ti => (ti.isValid = false));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  }, []);

  const currentInfo = activeInfo();
  const offset = currentInfo && currentInfo.distance ? currentInfo.distance : 25;

  return (
    <>
      {currentInfo ? (
        <Popover
          bodyContent={currentInfo.description ? t(currentInfo.description) : currentInfo.htmlDescription}
          distance={offset}
          footerContent={
            <div className={buttonsStyle}>
              {backButton()}
              {nextButton()}
            </div>
          }
          headerContent={
            <div>
              <span className={stopNumberStyle}>{activeStop! + 1}</span>
              <span>{t(currentInfo.name)}</span>
            </div>
          }
          isVisible={true}
          onHidden={onHidden}
          position={currentInfo.position}
          shouldClose={(_event, _) => shouldClose()}
        >
          <>{children}</>
        </Popover>
      ) : (
        <>{children}</>
      )}
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  activeTour: state.tourState.activeTour,
  activeStop: state.tourState.activeStop
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    endTour: bindActionCreators(TourActions.endTour, dispatch),
    setStop: bindActionCreators(TourActions.setStop, dispatch)
  };
};

export const TourStop = React.memo(connect(mapStateToProps, mapDispatchToProps)(TourStopComponent));

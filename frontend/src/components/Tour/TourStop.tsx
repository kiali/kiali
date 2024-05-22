import * as React from 'react';
import { Button, ButtonVariant, Popover, PopoverPosition } from '@patternfly/react-core';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { KialiAppState } from 'store/Store';
import ReactResizeDetector from 'react-resize-detector';
import { KialiIcon } from 'config/KialiIcon';
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

class TourStopComponent extends React.PureComponent<TourStopProps> {
  tourStopInfo: TourStopInfo[];

  constructor(props: TourStopProps) {
    super(props);

    this.tourStopInfo = Array.isArray(props.info) ? props.info : [props.info];
  }

  private getStop = (direction: 'back' | 'forward'): number | undefined => {
    if (this.props.activeStop === undefined) {
      return undefined;
    }

    return getNextTourStop(this.props.activeTour!, this.props.activeStop!, direction);
  };

  private setStop = (stop: number): void => {
    this.props.setStop(stop);
  };

  private backButton = (): React.ReactNode => {
    const stop = this.getStop('back');

    return (
      <Button isDisabled={stop === undefined} variant={ButtonVariant.secondary} onClick={() => this.setStop(stop!)}>
        <KialiIcon.AngleLeft /> {t('Back')}
      </Button>
    );
  };

  private nextButton = (): React.ReactNode => {
    const stop = this.getStop('forward');

    if (stop === undefined) {
      return (
        <Button variant={ButtonVariant.primary} onClick={this.props.endTour}>
          {t('Done')}
        </Button>
      );
    }

    return (
      <Button variant={ButtonVariant.primary} onClick={() => this.setStop(stop!)}>
        {t('Next')} <KialiIcon.AngleRight />
      </Button>
    );
  };

  private activeInfo = (): TourStopInfo | undefined => {
    for (const tsi of this.tourStopInfo) {
      const name = tsi.name;
      const isActive =
        this.props.activeTour !== undefined && name === this.props.activeTour.stops[this.props.activeStop!].name;

      if (isActive) {
        return tsi;
      }
    }

    return undefined;
  };

  // This is here to workaround what seems to be a bug.  As far as I know when isVisible is set then outside clicks should not hide
  // the Popover, but it seems to be happening in certain scenarios. So, if the Popover is still valid, unhide it immediately.
  private onHidden = (): void => {
    if (this.activeInfo()) {
      this.forceUpdate();
    }
  };

  private onResize = (): void => {
    if (this.activeInfo()) {
      this.forceUpdate();
    }
  };

  private shouldClose = (): void => {
    this.props.endTour();
  };

  componentDidMount(): void {
    this.tourStopInfo.forEach(ti => (ti.isValid = true));
  }

  componentWillUnmount(): void {
    this.tourStopInfo.forEach(ti => (ti.isValid = false));
  }

  render(): React.ReactNode {
    const info = this.activeInfo();
    const offset = info && info.distance ? info.distance : 25;
    const children = this.props.children;

    return (
      <>
        {info ? (
          <>
            <ReactResizeDetector
              refreshMode={'debounce'}
              refreshRate={100}
              skipOnMount={true}
              handleWidth={true}
              handleHeight={true}
              onResize={this.onResize}
            />
            <Popover
              bodyContent={info.description ? t(info.description) : info.htmlDescription}
              distance={offset}
              footerContent={
                <div className={buttonsStyle}>
                  {this.backButton()}
                  {this.nextButton()}
                </div>
              }
              headerContent={
                <div>
                  <span className={stopNumberStyle}>{this.props.activeStop! + 1}</span>
                  <span>{t(info.name)}</span>
                </div>
              }
              isVisible={true}
              onHidden={this.onHidden}
              position={info.position}
              shouldClose={(_event, _) => this.shouldClose(_)}
            >
              <>{children}</>
            </Popover>
          </>
        ) : (
          <>{children}</>
        )}
      </>
    );
  }
}

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

export const TourStop = connect(mapStateToProps, mapDispatchToProps)(TourStopComponent);

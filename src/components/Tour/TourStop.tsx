import * as React from 'react';
import { Button, Popover, PopoverPosition } from '@patternfly/react-core';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from 'store/Store';
import ReactResizeDetector from 'react-resize-detector';
import { KialiIcon } from 'config/KialiIcon';
import { KialiAppAction } from 'actions/KialiAppAction';
import { TourActions } from 'actions/TourActions';
import { style } from 'typestyle';
import { PfColors } from 'components/Pf/PfColors';

export interface TourStopInfo {
  name: string; // displayed in the tour stop header.
  description: string; // displayed as the tour stop body
  position?: PopoverPosition;
  offset?: string; // tippy prop: 'xOffset, yOffset'
  isValid?: boolean; // internal use, leave unset
}

export interface TourInfo {
  name: string;
  stops: Array<TourStopInfo>;
}

const stopNumberStyle = style({
  borderRadius: '20px',
  backgroundColor: PfColors.Blue300,
  padding: '2px 6px',
  marginRight: '10px',
  color: PfColors.White
});

type ReduxProps = {
  activeTour?: TourInfo;
  activeStop?: number;

  endTour: () => void;
  setStop: (stop: number) => void;
};

type TourStopProps = ReduxProps & {
  children?: React.ReactNode;
  info: TourStopInfo;
};

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

class TourStop extends React.PureComponent<TourStopProps> {
  tourStopInfo: TourStopInfo;

  constructor(props: TourStopProps) {
    super(props);

    this.tourStopInfo = props.info;
  }

  private getStop = (direction: 'back' | 'forward'): number | undefined => {
    if (this.props.activeStop === undefined) {
      return undefined;
    }

    return getNextTourStop(this.props.activeTour!, this.props.activeStop!, direction);
  };

  private setStop = (stop: number) => {
    this.props.setStop(stop);
  };

  private backButton = () => {
    const stop = this.getStop('back');
    return (
      <Button isDisabled={stop === undefined} variant="secondary" onClick={() => this.setStop(stop!)}>
        <KialiIcon.AngleLeft /> Back
      </Button>
    );
  };

  private nextButton = () => {
    const right = style({
      float: 'right'
    });
    const stop = this.getStop('forward');

    if (stop === undefined) {
      return (
        <Button className={right} variant="primary" onClick={this.props.endTour}>
          Done
        </Button>
      );
    }

    return (
      <Button className={right} variant="primary" onClick={() => this.setStop(stop!)}>
        Next <KialiIcon.AngleRight />
      </Button>
    );
  };

  private isVisible = (): boolean => {
    const name = this.props.info.name;
    const isVisible: boolean =
      this.props.activeTour !== undefined && name === this.props.activeTour.stops[this.props.activeStop!].name;
    return isVisible;
  };

  // This is here to workaround what seems to be a bug.  As far as I know when isVisible is set then outside clicks should not hide
  // the Popover, but it seems to be happening in certain scenarios. So, if the Popover is still valid, unhide it immediately.
  private onHidden = () => {
    if (this.isVisible()) {
      this.forceUpdate();
    }
  };

  private onResize = () => {
    if (this.isVisible()) {
      this.forceUpdate();
    }
  };

  private shouldClose = () => {
    this.props.endTour();
  };

  componentWillUnmount() {
    this.tourStopInfo.isValid = false;
  }

  render() {
    const offset: string = this.props.info.offset ? this.props.info.offset : '0, 0';
    const tippyProps: Partial<any> = { offset: offset };
    const isVisible = this.isVisible();
    this.tourStopInfo.isValid = true;
    const children = this.props.children;

    return (
      <>
        {isVisible ? (
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
              isVisible={true}
              shouldClose={this.shouldClose}
              onHidden={this.onHidden}
              position={this.props.info.position}
              tippyProps={tippyProps}
              headerContent={
                <div>
                  <span className={stopNumberStyle}>{this.props.activeStop! + 1}</span>
                  <span>{this.props.info.name}</span>
                </div>
              }
              bodyContent={this.props.info.description}
              footerContent={
                <div>
                  {this.backButton()}
                  {this.nextButton()}
                </div>
              }
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

const mapStateToProps = (state: KialiAppState) => ({
  activeTour: state.tourState.activeTour,
  activeStop: state.tourState.activeStop
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    endTour: bindActionCreators(TourActions.endTour, dispatch),
    setStop: bindActionCreators(TourActions.setStop, dispatch)
  };
};

const TourStopContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(TourStop);

export default TourStopContainer;

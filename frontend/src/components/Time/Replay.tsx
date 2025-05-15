import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { KialiAppState } from 'store/Store';
import { replayQueryTimeSelector, durationSelector } from 'store/Selectors';
import { Tooltip, ButtonVariant, Button, Content } from '@patternfly/react-core';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { Slider } from 'components/IstioWizards/Slider/Slider';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { toString } from './Utils';
import { serverConfig } from 'config';
import { PFColors } from 'components/Pf/PfColors';
import { DateTimePicker } from './DateTimePicker';
import _ from 'lodash';
import { HistoryManager, URLParam, location } from 'app/History';

type ReduxStateProps = {
  duration: DurationInSeconds;
  replayQueryTime: TimeInMilliseconds;
};

type ReduxDispatchProps = {
  setReplayQueryTime: (replayQueryTime: TimeInMilliseconds) => void;
  toggleReplayActive: () => void;
};

type ReplayProps = ReduxStateProps &
  ReduxDispatchProps & {
    id: string;
  };

type ReplayWindow = {
  interval: IntervalInMilliseconds;
  startTime: TimeInMilliseconds;
};

type ReplayStatus = 'initialized' | 'playing' | 'paused' | 'done';

type ReplayState = {
  isCustomStartTime: boolean;
  refresherRef?: number;
  replayFrame: number;
  replayFrameCount: number;
  replaySpeed: IntervalInMilliseconds;
  replayWindow: ReplayWindow;
  status: ReplayStatus;
};

type ReplaySpeed = {
  speed: IntervalInMilliseconds;
  text: string;
};

export const replayBorder = kialiStyle({
  borderLeft: `solid 0.25rem ${PFColors.Replay}`
});

/**
 * Overrides for Replay use of the Slider component.
 * - to avoid the tt occluding other components (like close replay), limit to when mouse is over the slider only,
 * not the tooltip area itself.
 * - to avoid the tooltip getting clipped on the right, add padding to move the shift the "attach" point
 */
const replaySliderStyle = kialiStyle({
  $nest: {
    '& .slider': {
      $nest: {
        '& .slider-selection.tick-slider-selection': {
          background: `${PFColors.Replay}` /* CODEMODS: original v5 color was --pf-v6-global--active-color--300 */
        },

        '& .tooltip': {
          pointerEvents: 'none',
          paddingRight: '175px'
        }
      }
    }
  }
});

// key represents replay interval in milliseconds
const replayIntervals = {
  60000: '1 minute',
  300000: '5 minutes',
  600000: '10 minutes',
  1800000: '30 minutes'
};

const replayLastIntervals = _.mapValues(replayIntervals, i => `Last ${i}`);

// key represents speed in milliseconds (i.e. how long to wait before refreshing-the-frame (fetching new data)
const replaySpeeds: ReplaySpeed[] = [
  { speed: 5000, text: 'slow' },
  { speed: 3000, text: 'medium' },
  { speed: 1000, text: 'fast' }
];

const defaultReplayInterval: IntervalInMilliseconds = 300000; // 5 minutes
const defaultReplaySpeed: IntervalInMilliseconds = 3000; // medium
const frameInterval: IntervalInMilliseconds = 10000; // clock advances 10s per frame

const controlStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '0.25rem'
});

const controlButtonStyle = kialiStyle({
  marginLeft: '33%',
  paddingRight: '0.5rem',
  height: '2rem'
});

const controlIconStyle = kialiStyle({
  fontSize: '1.5em'
});

const frameStyle = kialiStyle({
  marginRight: '1.25rem'
});

const isCustomStyle = kialiStyle({
  height: '2.25rem'
});

const isCustomActiveStyle = kialiStyle({
  color: PFColors.Active
});

const replayStyle = kialiStyle({
  display: 'flex',
  width: '100%',
  padding: '0 0.25rem 0 0.5rem'
});

const sliderStyle = kialiStyle({
  width: '100%',
  margin: '0 -0.5rem 0 1.25rem'
});

const speedStyle = kialiStyle({
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem'
});

const speedActiveStyle = kialiStyle({
  color: PFColors.Active,
  fontWeight: 'bolder'
});

const vrStyle = kialiStyle({
  border: '1px inset',
  height: '1.25rem',
  marginTop: '0.25rem'
});

class ReplayComponent extends React.PureComponent<ReplayProps, ReplayState> {
  static getFrameCount = (elapsedTime: IntervalInMilliseconds): number => {
    return elapsedTime > 0 ? Math.floor(elapsedTime / frameInterval) : 0;
  };

  static queryTimeToFrame = (replayQueryTime: TimeInMilliseconds, replayStartTime: TimeInMilliseconds): number => {
    const elapsedTime: IntervalInMilliseconds = replayQueryTime - replayStartTime;
    const frame: number = ReplayComponent.getFrameCount(elapsedTime);
    return frame;
  };

  static frameToQueryTime = (frame: number, replayWindow: ReplayWindow): TimeInMilliseconds => {
    return replayWindow.startTime + frame * frameInterval;
  };

  constructor(props: ReplayProps) {
    super(props);

    // Let URL set initial state at construction time.
    // Note, URLParam.GRAPH_REPLAY_START is only set for custom start times
    let interval = defaultReplayInterval;
    const urlParams = new URLSearchParams(location.getSearch());
    const urlReplayInterval = HistoryManager.getParam(URLParam.GRAPH_REPLAY_INTERVAL, urlParams);

    if (!!urlReplayInterval) {
      interval = Number(urlReplayInterval);
    }

    let startTime = new Date().getTime() - interval;
    let isCustomStartTime = false;
    const urlReplayStart = HistoryManager.getParam(URLParam.GRAPH_REPLAY_START, urlParams);

    if (!!urlReplayStart) {
      startTime = Number(urlReplayStart);
      isCustomStartTime = true;
    }

    this.state = {
      isCustomStartTime: isCustomStartTime,
      refresherRef: undefined,
      replayFrame: ReplayComponent.queryTimeToFrame(0, startTime),
      replayFrameCount: ReplayComponent.getFrameCount(interval),
      replaySpeed: defaultReplaySpeed,
      replayWindow: { interval: interval, startTime: startTime } as ReplayWindow,
      status: 'initialized'
    };
  }

  componentDidUpdate(_prevProps: ReplayProps, prevState: ReplayState): void {
    const isCustomStartChange = this.state.isCustomStartTime !== prevState.isCustomStartTime;
    const isIntervalChange = this.state.replayWindow.interval !== prevState.replayWindow.interval;

    if (isCustomStartChange || isIntervalChange) {
      this.initReplay();
      return;
    }

    let refresherChange = this.state.status !== prevState.status;
    refresherChange = refresherChange || this.state.replaySpeed !== prevState.replaySpeed;

    if (refresherChange) {
      this.updateRefresher();
    }

    if (this.state.status !== 'initialized') {
      const frameQueryTime = ReplayComponent.frameToQueryTime(this.state.replayFrame, this.state.replayWindow);
      if (frameQueryTime !== this.props.replayQueryTime) {
        this.props.setReplayQueryTime(frameQueryTime);
      }
    }
  }

  componentWillUnmount(): void {
    HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_INTERVAL);
    HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_START);

    if (this.state.refresherRef) {
      clearInterval(this.state.refresherRef);
    }
  }

  render(): React.ReactNode {
    if (!this.state.replayWindow.startTime) {
      return null;
    }

    const selectedTime: Date = new Date(this.state.replayWindow.startTime);
    const endTime: TimeInMilliseconds = selectedTime.getTime() + this.state.replayWindow.interval;
    const endString = toString(endTime, { month: undefined, day: undefined, second: '2-digit' });
    const ticks: number[] = Array.from(Array(this.state.replayFrameCount).keys());
    const now = Date.now();
    const maxTime: Date = new Date(now - this.state.replayWindow.interval);
    const minTime: Date = new Date(
      now - (serverConfig.prometheus.storageTsdbRetention! * 1000 + this.state.replayWindow.interval)
    );

    const dropdownOptions = this.state.isCustomStartTime ? replayIntervals : replayLastIntervals;

    return (
      <div className={`${replayStyle} ${replayBorder}`}>
        {this.state.isCustomStartTime && (
          <Tooltip content="Replay start time">
            <DateTimePicker
              injectTimes={[maxTime]}
              maxDate={maxTime}
              minDate={minTime}
              onChange={(date: Date) => this.onPickerChange(date)}
              selected={selectedTime}
            />
          </Tooltip>
        )}

        <ToolbarDropdown
          id="replay-interval"
          className={isCustomStyle}
          handleSelect={key => this.setReplayInterval(Number(key))}
          value={String(this.state.replayWindow.interval)}
          label={dropdownOptions[this.state.replayWindow.interval]}
          options={dropdownOptions}
          tooltip="Replay length"
        />

        <Tooltip
          key="toggle-is-custom"
          position="top"
          content={`Set ${this.state.isCustomStartTime ? 'simple' : 'custom'} start time`}
        >
          <Button className={isCustomStyle} variant={ButtonVariant.control} onClick={this.toggleCustomStartTime}>
            <KialiIcon.UserClock className={this.state.isCustomStartTime ? isCustomActiveStyle : ''} />
          </Button>
        </Tooltip>

        <span className={sliderStyle}>
          <div className={replaySliderStyle}>
            <Slider
              key={endString} // on new endTime force new slider because of bug updating tick labels
              id="replay-slider"
              orientation="horizontal"
              min={0}
              max={this.state.replayFrameCount}
              maxLimit={this.state.replayFrameCount}
              step={1}
              value={this.state.replayFrame}
              ticks={ticks}
              tooltip={true}
              tooltipFormatter={this.formatTooltip}
              onSlideStop={this.setReplayFrame}
              input={false}
              locked={false}
              showLock={false}
              mirrored={false}
              showMirror={false}
            />
          </div>

          <span className={controlStyle}>
            {this.state.status === 'playing' ? (
              <Tooltip key="replay-pause" position="top" content="Pause" entryDelay={1000}>
                <Button
                  data-test="graph-replay-pause-button"
                  className={controlButtonStyle}
                  variant={ButtonVariant.link}
                  onClick={this.pause}
                >
                  <KialiIcon.PauseCircle className={controlIconStyle} />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip
                key="replay-play"
                position="top"
                content={this.state.status === 'done' ? 'Play again' : 'Play'}
                entryDelay={1000}
              >
                <Button
                  data-test="graph-replay-play-button"
                  className={controlButtonStyle}
                  variant={ButtonVariant.link}
                  onClick={this.play}
                >
                  <KialiIcon.PlayCircle className={controlIconStyle} />
                </Button>
              </Tooltip>
            )}

            <Content className={frameStyle}>{this.formatFrame(this.state.replayFrame)}</Content>

            {replaySpeeds.map((s, i, a) => this.speedButton(s, i === a.length - 1))}
          </span>
        </span>
      </div>
    );
  }

  formatTooltip = (val: number): string => {
    const time: string = toString(ReplayComponent.frameToQueryTime(val, this.state.replayWindow), {
      second: '2-digit'
    });

    return `${time} [${val}/${this.state.replayFrameCount}]`;
  };

  formatFrame = (frame: number): string => {
    const elapsedTime: IntervalInMilliseconds = frame * frameInterval;
    const elapsedSec: number = Math.floor((elapsedTime / 1000) % 60);
    const elapsedMin: number = Math.floor((elapsedTime / 1000 - elapsedSec) / 60);
    const zeroPadSec: string = elapsedSec < 10 ? '0' : '';
    const zeroPadMin: string = elapsedMin < 10 ? '0' : '';
    const elapsed = `${zeroPadMin}${elapsedMin}:${zeroPadSec}${elapsedSec}`;

    return elapsed;
  };

  private toggleCustomStartTime = (): void => {
    this.setState({ isCustomStartTime: !this.state.isCustomStartTime });
  };

  private onPickerChange = (date: Date): void => {
    this.setReplayStartTime(date.getTime());
  };

  private initReplay = (): void => {
    const interval: IntervalInMilliseconds = !!this.state.replayWindow.interval
      ? this.state.replayWindow.interval
      : defaultReplayInterval;

    const startTime: TimeInMilliseconds = this.state.isCustomStartTime
      ? this.state.replayWindow.startTime
      : new Date().getTime() - interval;

    this.setState({ status: 'initialized' });
    this.setReplayWindow({ interval: interval, startTime: startTime } as ReplayWindow);
  };

  private setReplayStartTime = (startTime: TimeInMilliseconds): void => {
    this.setReplayWindow({ interval: this.state.replayWindow.interval, startTime: startTime });
  };

  private setReplayInterval = (interval: IntervalInMilliseconds): void => {
    this.setReplayWindow({ interval: interval, startTime: this.state.replayWindow.startTime });
  };

  private setReplayWindow = (replayWindow: ReplayWindow): void => {
    // For simplicity/readability, round custom start times to the minute.
    if (this.state.isCustomStartTime) {
      replayWindow.startTime = new Date(replayWindow.startTime).setSeconds(0, 0);
    }

    // ensure redux state and URL are aligned
    if (replayWindow.interval === defaultReplayInterval) {
      HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_INTERVAL);
    } else if (replayWindow.interval !== this.state.replayWindow.interval) {
      HistoryManager.setParam(URLParam.GRAPH_REPLAY_INTERVAL, String(replayWindow.interval));
    }

    if (!this.state.isCustomStartTime || !replayWindow.startTime) {
      HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_START);
    } else if (replayWindow.startTime !== this.state.replayWindow.startTime) {
      HistoryManager.setParam(URLParam.GRAPH_REPLAY_START, String(replayWindow.startTime));
    }

    const frameCount = ReplayComponent.getFrameCount(replayWindow.interval);

    this.setState({
      replayFrame: 0,
      replayFrameCount: frameCount,
      replayWindow: replayWindow
    });
  };

  private setReplaySpeed = (replaySpeed: IntervalInMilliseconds): void => {
    this.setState({ replaySpeed: replaySpeed });
  };

  private done = (): void => {
    this.setState({ status: 'done' });
  };

  private pause = (): void => {
    this.setState({ status: 'paused' });
  };

  private play = (): void => {
    const atEnd = this.state.replayFrame >= this.state.replayFrameCount;
    this.setState({ replayFrame: atEnd ? 0 : this.state.replayFrame, status: 'playing' });
  };

  private setReplayFrame = (frame: number): void => {
    if (frame !== this.state.replayFrame) {
      let status: ReplayStatus = this.state.status === 'initialized' ? 'initialized' : 'paused';
      status = frame === this.state.replayFrameCount ? 'done' : status;
      this.setState({ replayFrame: frame, status: status });
    }
  };

  private updateRefresher = (): void => {
    if (this.state.refresherRef) {
      clearInterval(this.state.refresherRef);
    }
    if (this.state.status !== 'playing' || !this.state.replayWindow.interval) {
      return;
    }

    let refresherRef: number | undefined = undefined;
    refresherRef = window.setInterval(this.handleRefresh, this.state.replaySpeed);
    this.setState({ refresherRef: refresherRef });
  };

  private handleRefresh = (): void => {
    const nextFrame = this.state.replayFrame + 1;

    if (nextFrame > this.state.replayFrameCount) {
      this.done();
    } else {
      this.setState({ replayFrame: nextFrame });
      this.props.setReplayQueryTime(ReplayComponent.frameToQueryTime(nextFrame, this.state.replayWindow));
    }
  };

  private speedButton = (replaySpeed: ReplaySpeed, isLast: boolean): React.ReactNode => {
    const isActive = this.state.replaySpeed === replaySpeed.speed;

    return (
      <>
        <Button
          icon={<Content className={isActive ? speedActiveStyle : undefined}>{replaySpeed.text}</Content>}
          data-test={`speed-${replaySpeed.text}`}
          key={`speed-${replaySpeed.text}`}
          className={speedStyle}
          variant={ButtonVariant.plain}
          isClicked={isActive}
          onClick={() => this.setReplaySpeed(replaySpeed.speed)}
        />

        {!isLast && <div className={vrStyle} />}
      </>
    );
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  duration: durationSelector(state),
  replayQueryTime: replayQueryTimeSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setReplayQueryTime: bindActionCreators(UserSettingsActions.setReplayQueryTime, dispatch),
  toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
});

export const Replay = connect(mapStateToProps, mapDispatchToProps)(ReplayComponent);

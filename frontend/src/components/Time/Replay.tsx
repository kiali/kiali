import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from 'store/Store';
import { replayQueryTimeSelector, durationSelector } from 'store/Selectors';
import { Tooltip, ButtonVariant, Button, Text } from '@patternfly/react-core';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import ToolbarDropdown from 'components/ToolbarDropdown/ToolbarDropdown';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { KialiAppAction } from 'actions/KialiAppAction';
import Slider from 'components/IstioWizards/Slider/Slider';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';
import { style } from 'typestyle';
import { toString } from './Utils';
import { serverConfig } from 'config';
import { PFColors } from 'components/Pf/PfColors';
import { DateTimePicker } from './DateTimePicker';
import _ from 'lodash';
import history, { HistoryManager, URLParam } from 'app/History';

type ReduxProps = {
  duration: DurationInSeconds;
  replayQueryTime: TimeInMilliseconds;

  setReplayQueryTime: (replayQueryTime: TimeInMilliseconds) => void;
  toggleReplayActive: () => void;
};

type ReplayProps = ReduxProps & {
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

export const replayBorder = style({
  borderLeft: `solid 5px ${PFColors.Replay}`
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

const controlStyle = style({
  display: 'flex',
  margin: '5px 0 0 15px'
});

const controlButtonStyle = style({
  margin: '-5px -5px 0 33%',
  height: '37px'
});

const controlIconStyle = style({
  fontSize: '1.5em'
});

const frameStyle = style({
  margin: '2px 20px 0 0'
});

const isCustomStyle = style({
  height: '36px'
});

const isCustomActiveStyle = style({
  color: PFColors.Active
});

const replayStyle = style({
  display: 'flex',
  width: '100%',
  padding: '5px 5px 0 10px',
  marginTop: '-5px'
});

const sliderStyle = style({
  width: '100%',
  margin: '0 -10px 0 20px'
});

const speedStyle = style({
  height: '1.5em',
  margin: '1px 5px 0 5px',
  padding: '0 2px 2px 2px'
});

const speedActiveStyle = style({
  color: PFColors.ActiveText,
  fontWeight: 'bolder'
});

const vrStyle = style({
  border: '1px inset',
  height: '20px',
  marginTop: '4px',
  width: '1px'
});

export class Replay extends React.PureComponent<ReplayProps, ReplayState> {
  static getFrameCount = (elapsedTime: IntervalInMilliseconds): number => {
    return elapsedTime > 0 ? Math.floor(elapsedTime / frameInterval) : 0;
  };

  static queryTimeToFrame = (replayQueryTime: TimeInMilliseconds, replayStartTime: TimeInMilliseconds): number => {
    const elapsedTime: IntervalInMilliseconds = replayQueryTime - replayStartTime;
    const frame: number = Replay.getFrameCount(elapsedTime);
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
    const urlParams = new URLSearchParams(history.location.search);
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
      replayFrame: Replay.queryTimeToFrame(0, startTime),
      replayFrameCount: Replay.getFrameCount(interval),
      replaySpeed: defaultReplaySpeed,
      replayWindow: { interval: interval, startTime: startTime } as ReplayWindow,
      status: 'initialized'
    };
  }

  componentDidUpdate(_prevProps: ReplayProps, prevState: ReplayState) {
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
      const frameQueryTime = Replay.frameToQueryTime(this.state.replayFrame, this.state.replayWindow);
      if (frameQueryTime !== this.props.replayQueryTime) {
        this.props.setReplayQueryTime(frameQueryTime);
      }
    }
  }

  componentWillUnmount() {
    HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_INTERVAL, true);
    HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_START, true);

    if (this.state.refresherRef) {
      clearInterval(this.state.refresherRef);
    }
  }

  render() {
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

    return (
      <div className={`${replayStyle} ${replayBorder}`}>
        {this.state.isCustomStartTime && (
          <Tooltip content="Replay start time">
            <DateTimePicker
              injectTimes={[maxTime]}
              maxDate={maxTime}
              minDate={minTime}
              onChange={date => this.onPickerChange(date)}
              selected={selectedTime}
            />
          </Tooltip>
        )}
        <ToolbarDropdown
          id={'replay-interval'}
          handleSelect={key => this.setReplayInterval(Number(key))}
          value={String(this.state.replayWindow.interval)}
          label={replayIntervals[this.state.replayWindow.interval]}
          options={this.state.isCustomStartTime ? replayIntervals : replayLastIntervals}
          tooltip="Replay length"
        />
        <Tooltip
          key="toggle-is-custom"
          position="top"
          content={`Set ${this.state.isCustomStartTime ? 'simple' : 'custom'} start time`}
        >
          <Button className={isCustomStyle} variant={ButtonVariant.control} onClick={this.toggleCustomStartTime}>
            <KialiIcon.UserClock
              className={this.state.isCustomStartTime ? `${defaultIconStyle} ${isCustomActiveStyle}` : defaultIconStyle}
            />
          </Button>
        </Tooltip>
        <span className={sliderStyle}>
          <div
            id="replay-slider-div" // see _Time.scss
          >
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
                <Button data-test="graph-replay-pause-button" className={controlButtonStyle} variant={ButtonVariant.link} onClick={this.pause}>
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
                <Button data-test="graph-replay-play-button" className={controlButtonStyle} variant={ButtonVariant.link} onClick={this.play}>
                  <KialiIcon.PlayCircle className={controlIconStyle} />
                </Button>
              </Tooltip>
            )}
            <Text className={frameStyle}>{this.formatFrame(this.state.replayFrame)}</Text>
            {replaySpeeds.map((s, i, a) => this.speedButton(s, i === a.length - 1))}
          </span>
        </span>
      </div>
    );
  }

  formatTooltip = (val: number): string => {
    const time: string = toString(Replay.frameToQueryTime(val, this.state.replayWindow), { second: '2-digit' });
    return `${time} [${val}/${this.state.replayFrameCount}]`;
  };

  formatFrame = (frame: number): string => {
    const elapsedTime: IntervalInMilliseconds = frame * frameInterval;
    const elapsedSec: number = Math.floor((elapsedTime / 1000) % 60);
    const elapsedMin: number = Math.floor((elapsedTime / 1000 - elapsedSec) / 60);
    const zeroPadSec: string = elapsedSec < 10 ? '0' : '';
    const zeroPadMin: string = elapsedMin < 10 ? '0' : '';
    const elapsed: string = `${zeroPadMin}${elapsedMin}:${zeroPadSec}${elapsedSec}`;
    return elapsed;
  };

  private toggleCustomStartTime = () => {
    this.setState({ isCustomStartTime: !this.state.isCustomStartTime });
  };

  private onPickerChange = (date: Date) => {
    this.setReplayStartTime(date.getTime());
  };

  private initReplay = () => {
    const interval: IntervalInMilliseconds = !!this.state.replayWindow.interval
      ? this.state.replayWindow.interval
      : defaultReplayInterval;

    const startTime: TimeInMilliseconds = this.state.isCustomStartTime
      ? this.state.replayWindow.startTime
      : new Date().getTime() - interval;

    this.setState({ status: 'initialized' });
    this.setReplayWindow({ interval: interval, startTime: startTime } as ReplayWindow);
  };

  private setReplayStartTime = (startTime: TimeInMilliseconds) => {
    this.setReplayWindow({ interval: this.state.replayWindow.interval, startTime: startTime });
  };

  private setReplayInterval = (interval: IntervalInMilliseconds) => {
    this.setReplayWindow({ interval: interval, startTime: this.state.replayWindow.startTime });
  };

  private setReplayWindow = (replayWindow: ReplayWindow) => {
    // For simplicity/readability, round custom start times to the minute.
    if (this.state.isCustomStartTime) {
      replayWindow.startTime = new Date(replayWindow.startTime).setSeconds(0, 0);
    }

    // ensure redux state and URL are aligned
    if (replayWindow.interval === defaultReplayInterval) {
      HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_INTERVAL, true);
    } else if (replayWindow.interval !== this.state.replayWindow.interval) {
      HistoryManager.setParam(URLParam.GRAPH_REPLAY_INTERVAL, String(replayWindow.interval));
    }
    if (!this.state.isCustomStartTime || !replayWindow.startTime) {
      HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_START, true);
    } else if (replayWindow.startTime !== this.state.replayWindow.startTime) {
      HistoryManager.setParam(URLParam.GRAPH_REPLAY_START, String(replayWindow.startTime));
    }

    const frameCount = Replay.getFrameCount(replayWindow.interval);
    this.setState({
      replayFrame: 0,
      replayFrameCount: frameCount,
      replayWindow: replayWindow
    });
  };

  private setReplaySpeed = (replaySpeed: IntervalInMilliseconds) => {
    this.setState({ replaySpeed: replaySpeed });
  };

  private done = () => {
    this.setState({ status: 'done' });
  };

  private pause = () => {
    this.setState({ status: 'paused' });
  };

  private play = () => {
    const atEnd = this.state.replayFrame >= this.state.replayFrameCount;
    this.setState({ replayFrame: atEnd ? 0 : this.state.replayFrame, status: 'playing' });
  };

  private setReplayFrame = (frame: number) => {
    if (frame !== this.state.replayFrame) {
      let status: ReplayStatus = this.state.status === 'initialized' ? 'initialized' : 'paused';
      status = frame === this.state.replayFrameCount ? 'done' : status;
      this.setState({ replayFrame: frame, status: status });
    }
  };

  private updateRefresher = () => {
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

  private handleRefresh = () => {
    const nextFrame = this.state.replayFrame + 1;
    if (nextFrame > this.state.replayFrameCount) {
      this.done();
    } else {
      this.setState({ replayFrame: nextFrame });
      this.props.setReplayQueryTime(Replay.frameToQueryTime(nextFrame, this.state.replayWindow));
    }
  };

  private speedButton = (replaySpeed: ReplaySpeed, isLast: boolean): React.ReactFragment => {
    const isActive = this.state.replaySpeed === replaySpeed.speed;
    return (
      <>
        <Button
          data-test={`speed-${replaySpeed.text}`}
          key={`speed-${replaySpeed.text}`}
          className={speedStyle}
          variant={ButtonVariant.plain}
          isActive={isActive}
          onClick={() => this.setReplaySpeed(replaySpeed.speed)}
        >
          <Text className={isActive ? speedActiveStyle : undefined}>{replaySpeed.text}</Text>
        </Button>
        {!isLast && <div className={vrStyle} />}
      </>
    );
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  replayQueryTime: replayQueryTimeSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setReplayQueryTime: bindActionCreators(UserSettingsActions.setReplayQueryTime, dispatch),
  toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
});

const ReplayContainer = connect(mapStateToProps, mapDispatchToProps)(Replay);

export default ReplayContainer;

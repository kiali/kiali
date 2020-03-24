import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from 'store/Store';
import { replayWindowSelector, replayQueryTimeSelector, durationSelector } from 'store/Selectors';
import { Tooltip, ButtonVariant, Button, Text } from '@patternfly/react-core';
import { ReplayWindow, DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import ToolbarDropdown from 'components/ToolbarDropdown/ToolbarDropdown';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { KialiAppAction } from 'actions/KialiAppAction';
import Slider from 'components/IstioWizards/Slider/Slider';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';
import { style } from 'typestyle';
import { toString } from './Utils';
import { serverConfig } from 'config';
import { PFKialiColor } from 'components/Pf/PfColors';
import { DateTimePicker } from './DateTimePicker';
import _ from 'lodash';

type ReduxProps = {
  duration: DurationInSeconds;
  replayQueryTime: TimeInMilliseconds;
  replayWindow: ReplayWindow;

  setReplayQueryTime: (replayQueryTime: TimeInMilliseconds) => void;
  setReplayWindow: (replayWindow: ReplayWindow) => void;
  toggleReplayActive: () => void;
};

type ReplayProps = ReduxProps & {
  id: string;
};

type ReplayStatus = 'init' | 'playing' | 'paused' | 'done';
type ReplayState = {
  isCustomStartTime: boolean;
  refresherRef?: number;
  replayFrame: number;
  replayFrameCount: number;
  replaySpeed: IntervalInMilliseconds;
  status: ReplayStatus;
};

type ReplaySpeed = {
  speed: IntervalInMilliseconds;
  text: string;
};

export const replayBorder = style({
  borderLeft: `solid 5px ${PFKialiColor.Replay}`
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
const frameInterval: IntervalInMilliseconds = 10000; // number of ms clock advances per frame

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
  color: PFKialiColor.Active
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
  color: PFKialiColor.ActiveText,
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

  static queryTimeToFrame = (props: ReduxProps): number => {
    const elapsedTime: IntervalInMilliseconds = props.replayQueryTime - props.replayWindow.startTime;
    const frame: number = Replay.getFrameCount(elapsedTime);
    return frame;
  };

  static frameToQueryTime = (frame: number, props: ReduxProps): TimeInMilliseconds => {
    return props.replayWindow.startTime + frame * frameInterval;
  };

  private pickerTime: TimeInMilliseconds = 0; // Time currently chosen via Datepicker

  constructor(props: ReplayProps) {
    super(props);
    this.state = {
      isCustomStartTime: false,
      refresherRef: undefined,
      replayFrame: Replay.queryTimeToFrame(props),
      replayFrameCount: Replay.getFrameCount(props.replayWindow.interval),
      replaySpeed: defaultReplaySpeed,
      status: 'init'
    };
  }

  componentDidMount() {
    if (!!!this.props.replayWindow.startTime) {
      this.initReplay();
    }
  }

  componentDidUpdate(prevProps: ReplayProps, prevState: ReplayState) {
    const isCustomStartChange = this.state.isCustomStartTime !== prevState.isCustomStartTime;
    const isIntervalChange = this.props.replayWindow.interval !== prevProps.replayWindow.interval;
    if (isCustomStartChange || isIntervalChange) {
      this.initReplay();
      return;
    }

    let refresherChange = this.state.status !== prevState.status;
    refresherChange = refresherChange || this.state.replaySpeed !== prevState.replaySpeed;
    if (refresherChange) {
      this.updateRefresher();
    }

    if (this.state.status !== 'init') {
      const frameQueryTime = Replay.frameToQueryTime(this.state.replayFrame, this.props);
      if (frameQueryTime !== this.props.replayQueryTime) {
        this.props.setReplayQueryTime(frameQueryTime);
      }
    }
  }

  componentWillUnmount() {
    if (this.state.refresherRef) {
      clearInterval(this.state.refresherRef);
    }
  }

  render() {
    if (!!!this.props.replayWindow.startTime) {
      return null;
    }

    const selectedTime: Date = new Date(this.props.replayWindow.startTime);
    const endTime: TimeInMilliseconds = selectedTime.getTime() + this.props.replayWindow.interval;
    const endString = toString(endTime, { month: undefined, day: undefined, second: '2-digit' });
    const ticks: number[] = Array.from(Array(this.state.replayFrameCount).keys());
    const now = Date.now();
    const maxTime: Date = new Date(now - this.props.replayWindow.interval);
    const minTime: Date = new Date(
      now - (serverConfig.prometheus.storageTsdbRetention! * 1000 + this.props.replayWindow.interval)
    );

    return (
      <div className={`${replayStyle} ${replayBorder}`}>
        {this.state.isCustomStartTime && (
          <Tooltip content="Replay start time">
            <DateTimePicker
              injectTimes={[maxTime]}
              maxDate={maxTime}
              maxTime={maxTime}
              minDate={minTime}
              minTime={minTime}
              onCalendarClose={() => this.onPickerClose()}
              onCalendarOpen={() => this.onPickerOpen()}
              onChange={date => this.onPickerChange(date)}
              selected={selectedTime}
            />
          </Tooltip>
        )}
        <ToolbarDropdown
          id={'replay-interval'}
          handleSelect={key => this.setReplayInterval(Number(key))}
          value={String(this.props.replayWindow.interval)}
          label={replayIntervals[this.props.replayWindow.interval]}
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
            />
          </div>
          <span className={controlStyle}>
            {this.state.status === 'playing' ? (
              <Tooltip key="replay-pause" position="top" content="Pause" entryDelay={1000}>
                <Button className={controlButtonStyle} variant={ButtonVariant.link} onClick={this.pause}>
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
                <Button className={controlButtonStyle} variant={ButtonVariant.link} onClick={this.play}>
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
    const time: string = toString(Replay.frameToQueryTime(val, this.props), { second: '2-digit' });
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
    this.pickerTime = date.getTime();
  };

  private onPickerClose = () => {
    if (this.pickerTime !== this.props.replayWindow.startTime) {
      this.setReplayStartTime(this.pickerTime);
    }
  };

  private onPickerOpen = () => {
    this.pickerTime = this.props.replayWindow.startTime;
  };

  private initReplay = () => {
    const interval: IntervalInMilliseconds = !!this.props.replayWindow.interval
      ? this.props.replayWindow.interval
      : defaultReplayInterval;

    // For simplicity/readability, round custom start times to the minute. Use seconds granularity for "Last <interval>"
    const startTime: TimeInMilliseconds = this.state.isCustomStartTime
      ? new Date().setSeconds(0, 0) - interval
      : new Date().getTime() - interval;

    this.setState({ status: 'init' });
    this.setReplayWindow({ interval: interval, startTime: startTime });
  };

  private setReplayStartTime = (startTime: TimeInMilliseconds) => {
    this.setReplayWindow({ interval: this.props.replayWindow.interval, startTime: startTime });
  };

  private setReplayInterval = (interval: IntervalInMilliseconds) => {
    const startTime: TimeInMilliseconds = this.state.isCustomStartTime
      ? this.props.replayWindow.startTime
      : Date.now() - interval;
    this.setReplayWindow({ interval: interval, startTime: startTime });
  };

  private setReplayWindow = (replayWindow: ReplayWindow) => {
    const frameCount = Replay.getFrameCount(replayWindow.interval);
    this.setState({ replayFrame: 0, replayFrameCount: frameCount });
    this.props.setReplayWindow(replayWindow);
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
      let status: ReplayStatus = this.state.status === 'init' ? 'init' : 'paused';
      status = frame === this.state.replayFrameCount ? 'done' : status;
      this.setState({ replayFrame: frame, status: status });
    }
  };

  private updateRefresher = () => {
    if (this.state.refresherRef) {
      clearInterval(this.state.refresherRef);
    }
    if (this.state.status !== 'playing' || !!!this.props.replayWindow.interval) {
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
      this.props.setReplayQueryTime(Replay.frameToQueryTime(nextFrame, this.props));
    }
  };

  private speedButton = (replaySpeed: ReplaySpeed, isLast: boolean): React.ReactFragment => {
    const isActive = this.state.replaySpeed === replaySpeed.speed;
    return (
      <>
        <Button
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
  replayQueryTime: replayQueryTimeSelector(state),
  replayWindow: replayWindowSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setReplayQueryTime: bindActionCreators(UserSettingsActions.setReplayQueryTime, dispatch),
  setReplayWindow: bindActionCreators(UserSettingsActions.setReplayWindow, dispatch),
  toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
});

const ReplayContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Replay);

export default ReplayContainer;

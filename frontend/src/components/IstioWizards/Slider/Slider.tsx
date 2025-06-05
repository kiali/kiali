import * as React from 'react';
import { BootstrapSlider } from './BootstrapSlider';
import { Button, ButtonVariant, InputGroupText, TextInput, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Boundaries } from './Boundaries';
import { kialiStyle } from 'styles/StyleUtils';
import { MinusIcon, PlusIcon, ThumbTackIcon, MigrationIcon } from '@patternfly/react-icons';

export const noop = Function.prototype;

type SliderProps = {
  id: string;
  input: boolean;
  inputFormat: string;
  locked: boolean;
  max: number;
  maxLimit: number;
  min: number;
  mirrored: boolean;
  onLock: (locked: boolean) => void;
  onMirror: (mirror: boolean) => void;
  onSlide: (value: number) => void;
  onSlideStop: (value: number) => void;
  orientation: string;
  showLock: boolean;
  showMirror: boolean;
  sliderClass: string;
  step: number;
  ticks: number[];
  ticks_labels: string[];
  tooltip: boolean;
  tooltipFormatter: (value: number) => string;
  value: number;
};

type SliderState = {
  tooltipFormat: string;
  value: number;
};

export class Slider extends React.Component<SliderProps, SliderState> {
  static defaultProps = {
    id: null,
    orientation: 'horizontal',
    min: 0,
    max: 100,
    maxLimit: 100,
    value: 0,
    step: 1,
    ticks: [],
    ticks_labels: [],
    toolTip: false,
    tooltipFormatter: noop,
    onSlide: noop,
    onSlideStop: noop,
    label: null,
    labelClass: null,
    input: false,
    sliderClass: null,
    inputFormat: '',
    locked: false,
    showLock: true,
    onLock: noop,
    showMirror: true,
    onMirror: noop
  };

  constructor(props: SliderProps) {
    super(props);

    this.state = {
      value: this.props.value,
      tooltipFormat: this.props.inputFormat
    };
  }

  componentDidMount(): void {
    // This empty setState forces a re-render which resolves an issue with initial tick_label placement
    this.setState({});
  }

  componentDidUpdate(prevProps: Readonly<SliderProps>): void {
    if (prevProps.value !== this.props.value || this.state.value !== this.props.value) {
      this.setState({ value: this.props.value });
    }
  }

  onSlide = (value: number): void => {
    this.setState({ value }, () => this.props.onSlide(value));
  };

  onSlideStop = (value: number): void => {
    this.setState({ value }, () => this.props.onSlideStop(value));
  };

  onPlus = (): void => {
    const newValue = Number(this.state.value || 0);
    this.updateNewValue(newValue + 1);
  };

  onMinus = (): void => {
    const newValue = Number(this.state.value || 0);
    this.updateNewValue(newValue - 1);
  };

  onInputChange = (value: string | number): void => {
    const newValue = Number(value);
    this.updateNewValue(Number.isNaN(newValue) ? 0 : newValue);
  };

  updateNewValue = (newValue: number): void => {
    if (newValue > this.props.max) {
      newValue = this.props.max;
    }

    if (newValue < 0) {
      newValue = 0;
    }

    this.setState({ value: newValue }, () => this.props.onSlide(newValue));
  };

  onFormatChange = (format: string): void => {
    this.setState({ tooltipFormat: format });
  };

  formatter = (value: number): string => {
    return this.props.tooltipFormatter !== noop
      ? this.props.tooltipFormatter(value)
      : `${value} ${this.state.tooltipFormat} ${this.props.mirrored ? ' mirrored traffic' : ''}`;
  };

  render(): React.ReactNode {
    const BSSlider = (
      <BootstrapSlider
        {...this.props}
        formatter={this.formatter}
        value={this.state.value}
        onSlide={this.onSlide}
        onSlideStop={this.onSlideStop}
      />
    );

    const leftButtonStyle = kialiStyle({
      width: '20px',
      paddingLeft: 0,
      paddingRight: 0,
      marginLeft: 0,
      marginRight: '5px'
    });

    const inputStyle = kialiStyle({
      width: '3rem',
      textAlign: 'center',
      marginLeft: 0,
      marginRight: 0
    });

    const rightButtonStyle = kialiStyle({
      width: '20px',
      paddingLeft: 0,
      paddingRight: 0,
      marginLeft: '5px',
      marginRight: '5px'
    });

    const pinButtonStyle = kialiStyle({
      paddingLeft: '8px',
      paddingRight: '8px'
    });

    const LockIcon = (
      <Tooltip
        position={TooltipPosition.top}
        content={<>{this.props.locked ? 'Unlock' : 'Lock'} Weight for this Workload</>}
      >
        <Button icon={<ThumbTackIcon />}
          className={pinButtonStyle}
          isDisabled={this.props.mirrored}
          variant={this.props.locked ? ButtonVariant.primary : ButtonVariant.secondary}
          onClick={() => this.props.onLock(!this.props.locked)}
        >
          
        </Button>
      </Tooltip>
    );

    const MirrorIcon = (
      <Tooltip position={TooltipPosition.top} content={<>Mirror % traffic to this Workload</>}>
        <Button icon={<MigrationIcon />}
          className={pinButtonStyle}
          variant={this.props.mirrored ? ButtonVariant.primary : ButtonVariant.secondary}
          onClick={() => this.props.onMirror(!this.props.mirrored)}
          style={{ marginLeft: '10px', marginRight: '10px' }}
        >
          
        </Button>
      </Tooltip>
    );

    return (
      <>
        <Boundaries slider={BSSlider} {...this.props}>
          {this.props.input && (
            <>
              <Button icon={<MinusIcon />}
                className={leftButtonStyle}
                variant={ButtonVariant.link}
                isDisabled={this.props.locked}
                onClick={() => this.onMinus()}
              >
                
              </Button>
              <TextInput
                className={inputStyle}
                id="slider-text"
                aria-label="slider-text"
                value={this.state.value}
                onChange={(_event, value: string | number) => this.onInputChange(value)}
                isDisabled={this.props.locked}
                data-test={`input-${this.props.id}`}
              />
              <Button icon={<PlusIcon />}
                className={rightButtonStyle}
                variant={ButtonVariant.link}
                isDisabled={this.props.locked}
                onClick={() => this.onPlus()}
              >
                
              </Button>
              <InputGroupText>{this.props.inputFormat}</InputGroupText>
            </>
          )}

          {this.props.showMirror ? MirrorIcon : <></>}

          {this.props.showLock ? LockIcon : <></>}
        </Boundaries>
      </>
    );
  }
}

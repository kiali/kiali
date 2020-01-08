import React from 'react';
import BootstrapSlider from './BootstrapSlider';
import { Button, ButtonVariant, InputGroupText, TextInput } from '@patternfly/react-core';
import Boundaries from './Boundaries';
import { style } from 'typestyle';
import { MinusIcon, PlusIcon, ThumbTackIcon } from '@patternfly/react-icons';

export const noop = Function.prototype;

type Props = {
  id: string;
  orientation: string;
  min: number;
  max: number;
  maxLimit: number;
  step: number;
  value: number;
  tooltip: boolean;
  onSlide: (value: number) => void;
  input: boolean;
  sliderClass: string;
  inputFormat: string;
  locked: boolean;
  showLock: boolean;
  onLock: (locked: boolean) => void;
};

type State = {
  value: number;
  tooltipFormat: string;
};

class Slider extends React.Component<Props, State> {
  static defaultProps = {
    id: null,
    orientation: 'horizontal',
    min: 0,
    max: 100,
    maxLimit: 100,
    value: 0,
    step: 1,
    toolTip: false,
    onSlide: noop,
    label: null,
    labelClass: null,
    input: false,
    sliderClass: null,
    inputFormat: '',
    locked: false,
    showLock: true,
    onLock: noop
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      value: this.props.value,
      tooltipFormat: this.props.inputFormat
    };
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.value !== this.props.value || this.state.value !== this.props.value) {
      this.setState({ value: this.props.value });
    }
  }

  onSlide = value => {
    this.setState({ value }, () => this.props.onSlide(value));
  };

  onPlus = () => {
    const newValue = Number(this.state.value || 0);
    this.updateNewValue(newValue + 1);
  };

  onMinus = () => {
    const newValue = Number(this.state.value || 0);
    this.updateNewValue(newValue - 1);
  };

  onInputChange = (value: string | number) => {
    const newValue: number = Number(value);
    this.updateNewValue(Number.isNaN(newValue) ? 0 : newValue);
  };

  updateNewValue = (newValue: number) => {
    if (newValue > this.props.max) {
      newValue = this.props.max;
    }
    if (newValue < 0) {
      newValue = 0;
    }
    this.setState({ value: newValue }, () => this.props.onSlide(newValue));
  };

  onFormatChange = format => {
    this.setState({ tooltipFormat: format });
  };

  formatter = value => `${value} ${this.state.tooltipFormat}`;

  render() {
    const BSSlider = (
      <BootstrapSlider
        {...this.props}
        locked={this.props.locked}
        formatter={this.formatter}
        value={this.state.value}
        onSlide={this.onSlide}
      />
    );

    const leftButtonStyle = style({
      width: '20px',
      paddingLeft: 0,
      paddingRight: 0,
      marginLeft: 0,
      marginRight: 5
    });
    const inputStyle = style({
      width: '2.75em',
      textAlign: 'center',
      marginLeft: 0,
      marginRight: 0
    });
    const rightButtonStyle = style({
      width: '20px',
      paddingLeft: 0,
      paddingRight: 0,
      marginLeft: 5,
      marginRight: 5
    });
    const pinButtonStyle = style({
      paddingLeft: 8,
      paddingRight: 8
    });
    const LockIcon = (
      <Button
        className={pinButtonStyle}
        variant={this.props.locked ? ButtonVariant.primary : ButtonVariant.secondary}
        onClick={() => this.props.onLock(!this.props.locked)}
      >
        <ThumbTackIcon />
      </Button>
    );

    return (
      <>
        <Boundaries slider={BSSlider} {...this.props}>
          <Button
            className={leftButtonStyle}
            variant="link"
            isDisabled={this.props.locked}
            onClick={() => this.onMinus()}
          >
            <MinusIcon />
          </Button>
          <TextInput
            className={inputStyle}
            id="slider-text"
            aria-label="slider-text"
            value={this.state.value}
            onChange={this.onInputChange}
            isDisabled={this.props.locked}
          />
          <Button
            className={rightButtonStyle}
            variant="link"
            isDisabled={this.props.locked}
            onClick={() => this.onPlus()}
          >
            <PlusIcon />
          </Button>
          <InputGroupText>{this.props.inputFormat}</InputGroupText>
          {this.props.showLock ? LockIcon : <></>}
        </Boundaries>
      </>
    );
  }
}

export default Slider;

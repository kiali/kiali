// Clone of Slider component to workaround issue https://github.com/patternfly/patternfly-react/issues/1221

import React from 'react';
import BootstrapSlider from './BootstrapSlider';
import { Button, Icon, ControlLabel, FormControl } from 'patternfly-react';
import Boundaries from './Boundaries';
import DropdownMenu from './DropdownMenu';
import { style } from 'typestyle';
import { hollowPinIcon, solidPinIcon } from '../../../config/Icons';

export const noop = Function.prototype;

type Props = {
  id: string;
  orientation: string;
  min: number;
  max: number;
  maxLimit: number;
  step: number;
  value: number[] | number;
  tooltip: boolean;
  onSlide: (value: number[] | number) => void;
  label: string;
  labelClass: string;
  icon: Icon;
  input: boolean;
  sliderClass: string;
  dropdownList: string[];
  inputFormat: string;
  locked: boolean;
  showLock: boolean;
  onLock: (locked: boolean) => void;
};

type State = {
  value: number[] | number;
  tooltipFormat: string;
};

const lockStyle = style({
  display: 'block',
  maxHeight: 18,
  padding: 2,
  width: '18px',
  height: '18px'
});

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
    icon: null,
    dropdownList: null,
    inputFormat: '',
    locked: false,
    showLock: true,
    onLock: noop
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      value: this.props.value,
      tooltipFormat: (this.props.dropdownList && this.props.dropdownList[0]) || this.props.inputFormat
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

  onInputChange = event => {
    const newValue = Number(event.target.value || 0);
    this.updateNewValue(newValue);
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
    let label: any = null;
    let sliderClass = 'col-xs-12 col-sm-12 col-md-12';
    const labelClass = 'col-xs-2 col-sm-2 col-md-2';
    if (this.props.label || this.props.icon) {
      sliderClass = 'col-xs-10 col-sm-10 col-md-10';
      label = this.props.icon ? (
        <Icon className={labelClass} {...this.props.icon} />
      ) : (
        <ControlLabel htmlFor={this.props.id} bsClass={labelClass}>
          {this.props.label}
        </ControlLabel>
      );
    }

    let formatElement;

    if (this.props.inputFormat) {
      formatElement = <span>{this.props.inputFormat}</span>;
    }

    if (this.props.dropdownList) {
      formatElement = (
        <DropdownMenu {...this.props} onFormatChange={this.onFormatChange} title={this.state.tooltipFormat} />
      );
    }

    const leftButtonStyle = { marginLeft: 5, marginRight: 0 };
    const leftButton = this.props.input && (
      <Button bsSize="xsmall" style={leftButtonStyle} onClick={() => this.onMinus()} disabled={this.props.locked}>
        <Icon type="fa" name="minus" />
      </Button>
    );

    const inputStyle = {
      width: '3.5em',
      textAlign: 'center',
      marginLeft: 0,
      marginRight: 0
    };
    const inputElement = this.props.input && (
      <FormControl
        bsClass="slider-input-pf"
        type="text"
        value={this.state.value}
        // Trick to fix InputText when slider is locked and refreshed/resized
        style={inputStyle}
        onChange={this.onInputChange}
        disabled={this.props.locked}
      />
    );

    const rightButtonStyle = { marginLeft: 0, marginRight: 5 };
    const rightButton = this.props.input && (
      <Button bsSize="xsmall" style={rightButtonStyle} onClick={() => this.onPlus()} disabled={this.props.locked}>
        <Icon type="fa" name="plus" />
      </Button>
    );

    const pinButtonStyle = { height: '23px' };
    const lockElement = (
      <Button bsSize="xsmall" style={pinButtonStyle} onClick={() => this.props.onLock(!this.props.locked)}>
        {this.props.locked ? (
          <img src={solidPinIcon} className={lockStyle} />
        ) : (
          <img src={hollowPinIcon} className={lockStyle} />
        )}
      </Button>
    );

    const BSSlider = (
      <BootstrapSlider
        {...this.props}
        locked={this.props.locked}
        formatter={this.formatter}
        value={this.state.value}
        onSlide={this.onSlide}
      />
    );
    return (
      <div>
        {label}
        <div className={sliderClass}>
          <Boundaries slider={BSSlider} {...this.props}>
            {leftButton}
            {inputElement}
            {rightButton}
            {formatElement}
            {this.props.showLock && lockElement}
          </Boundaries>
        </div>
      </div>
    );
  }
}

export default Slider;

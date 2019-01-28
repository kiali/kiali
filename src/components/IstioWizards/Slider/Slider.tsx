// Clone of Slider component to workaround issue https://github.com/patternfly/patternfly-react/issues/1221

import React from 'react';
import BootstrapSlider from './BootstrapSlider';
import { Icon, ControlLabel, FormControl } from 'patternfly-react';
import Boundaries from './Boundaries';
import DropdownMenu from './DropdownMenu';

export const noop = Function.prototype;

type Props = {
  id: string;
  orientation: string;
  min: number;
  max: number;
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
};

type State = {
  value: number[] | number;
  tooltipFormat: string;
};

class Slider extends React.Component<Props, State> {
  static defaultProps = {
    id: null,
    orientation: 'horizontal',
    min: 0,
    max: 100,
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
    inputFormat: ''
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

  onInputChange = event => {
    const newValue = Number(event.target.value || 0);
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

    const inputElement = this.props.input && (
      <FormControl
        bsClass="slider-input-pf"
        type="number"
        value={this.state.value}
        min={this.props.min}
        max={this.props.max}
        onChange={this.onInputChange}
      />
    );

    const BSSlider = (
      <BootstrapSlider {...this.props} formatter={this.formatter} value={this.state.value} onSlide={this.onSlide} />
    );

    return (
      <div>
        {label}
        <div className={sliderClass}>
          <Boundaries slider={BSSlider} {...this.props}>
            {inputElement}
            {formatElement}
          </Boundaries>
        </div>
      </div>
    );
  }
}

export default Slider;

import * as React from 'react';
import { ButtonGroup, Button } from 'patternfly-react';
import PropTypes from 'prop-types';

type DurationButtonGroupProps = {
  disabled: boolean;
  initialDuration: string;
  onClick: PropTypes.func;
};

type DurationButtonGroupState = {
  current: string;
};

export class DurationButtonGroup extends React.Component<DurationButtonGroupProps, DurationButtonGroupState> {
  constructor(props: DurationButtonGroupProps) {
    super(props);
    this.state = {
      current: props.initialDuration
    };
  }

  Duration = (e: any) => {
    this.setState({ current: e.target.id });
    this.props.onClick(e.target.id);
  };

  render() {
    return (
      <ButtonGroup>
        <Button disabled={this.props.disabled} onClick={this.Duration} active={this.state.current === '60'} id="60">
          1m
        </Button>
        <Button disabled={this.props.disabled} onClick={this.Duration} active={this.state.current === '600'} id="600">
          10m
        </Button>
        <Button disabled={this.props.disabled} onClick={this.Duration} active={this.state.current === '1800'} id="1800">
          30m
        </Button>
        <Button disabled={this.props.disabled} onClick={this.Duration} active={this.state.current === '3600'} id="3600">
          1h
        </Button>
        <Button
          disabled={this.props.disabled}
          onClick={this.Duration}
          active={this.state.current === '14400'}
          id="14400"
        >
          4h
        </Button>
        <Button
          disabled={this.props.disabled}
          onClick={this.Duration}
          active={this.state.current === '28800'}
          id="28800"
        >
          8h
        </Button>
        <Button
          disabled={this.props.disabled}
          onClick={this.Duration}
          active={this.state.current === '86400'}
          id="86400"
        >
          1d
        </Button>
        <Button
          disabled={this.props.disabled}
          onClick={this.Duration}
          active={this.state.current === '604800'}
          id="604800"
        >
          7d
        </Button>
        <Button
          disabled={this.props.disabled}
          onClick={this.Duration}
          active={this.state.current === '2592000'}
          id="2592000"
        >
          30d
        </Button>
      </ButtonGroup>
    );
  }
}

import * as React from 'react';
import { ButtonGroup, Button } from 'patternfly-react';
import PropTypes from 'prop-types';

type IntervalButtonGroupProps = {
  initialInterval: string;
  onClick: PropTypes.func;
};

type IntervalButtonGroupState = {
  current: string;
};

export class IntervalButtonGroup extends React.Component<IntervalButtonGroupProps, IntervalButtonGroupState> {
  constructor(props: IntervalButtonGroupProps) {
    super(props);
    this.state = {
      current: props.initialInterval
    };
  }

  Interval = (e: any) => {
    this.setState({ current: e.target.id });
    this.props.onClick(e.target.id);
  };

  render() {
    return (
      <ButtonGroup>
        <Button onClick={this.Interval} active={this.state.current === '30s'} id="30s">
          30s
        </Button>
        <Button onClick={this.Interval} active={this.state.current === '5m'} id="5m">
          5m
        </Button>
        <Button onClick={this.Interval} active={this.state.current === '10m'} id="10m">
          10m
        </Button>
        <Button onClick={this.Interval} active={this.state.current === '1h'} id="1h">
          1h
        </Button>
        <Button onClick={this.Interval} active={this.state.current === '4h'} id="4h">
          4h
        </Button>
        <Button onClick={this.Interval} active={this.state.current === '8h'} id="8h">
          8h
        </Button>
        <Button onClick={this.Interval} active={this.state.current === '1d'} id="1d">
          1d
        </Button>
        <Button onClick={this.Interval} active={this.state.current === '7d'} id="7d">
          7d
        </Button>
        <Button onClick={this.Interval} active={this.state.current === '30d'} id="30d">
          30d
        </Button>
      </ButtonGroup>
    );
  }
}

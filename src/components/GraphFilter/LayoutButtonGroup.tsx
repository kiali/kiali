import * as React from 'react';
import { ButtonGroup, Button } from 'patternfly-react';
import PropTypes from 'prop-types';

type LayoutButtonGroupProps = {
  disabled: boolean;
  initialLayout: string;
  onClick: PropTypes.func;
};

type LayoutButtonGroupState = {
  current: string;
};

export class LayoutButtonGroup extends React.Component<LayoutButtonGroupProps, LayoutButtonGroupState> {
  constructor(props: LayoutButtonGroupProps) {
    super(props);
    this.state = {
      current: props.initialLayout
    };
  }

  layout = (e: any) => {
    this.setState({ current: e.target.id });
    this.props.onClick(e.target.id);
  };

  render() {
    return (
      <ButtonGroup>
        <Button
          disabled={this.props.disabled}
          onClick={this.layout}
          active={this.state.current === 'breadthfirst'}
          id="breadthfirst"
        >
          Breadthfirst
        </Button>
        <Button disabled={this.props.disabled} onClick={this.layout} active={this.state.current === 'cola'} id="cola">
          Cola
        </Button>
        <Button disabled={this.props.disabled} onClick={this.layout} active={this.state.current === 'cose'} id="cose">
          Cose
        </Button>
        <Button disabled={this.props.disabled} onClick={this.layout} active={this.state.current === 'dagre'} id="dagre">
          Dagre
        </Button>
        <Button disabled={this.props.disabled} onClick={this.layout} active={this.state.current === 'klay'} id="klay">
          Klay
        </Button>
      </ButtonGroup>
    );
  }
}

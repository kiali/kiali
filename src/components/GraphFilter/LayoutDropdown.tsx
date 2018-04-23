import * as React from 'react';
import { DropdownButton, MenuItem } from 'patternfly-react';
import PropTypes from 'prop-types';

type LayoutDropdownProps = {
  disabled: boolean;
  initialLayout: string;
  onClick: PropTypes.func;
};

type LayoutDropdownState = {
  currentGraphType: string;
};

export class LayoutDropdown extends React.Component<LayoutDropdownProps, LayoutDropdownState> {
  static GraphTypes = [
    ['breadthfirst', 'Breadthfirst'],
    ['cola', 'Cola'],
    ['cose', 'Cose'],
    ['dagre', 'Dagre'],
    ['klay', 'Klay']
  ];
  constructor(props: LayoutDropdownProps) {
    super(props);
    this.state = {
      currentGraphType: props.initialLayout
    };
  }

  layout = (graphType: string) => {
    this.setState({ currentGraphType: graphType });
    this.props.onClick(graphType);
  };

  render() {
    return (
      <DropdownButton id="graphType" title="Type of Graph" onSelect={this.layout}>
        {LayoutDropdown.GraphTypes.map(r => (
          <MenuItem
            key={r[0]}
            active={r[0] === this.state.currentGraphType}
            id={r[0]}
            eventKey={r[0]}
            disabled={this.props.disabled}
          >
            {r[1]}
          </MenuItem>
        ))}
      </DropdownButton>
    );
  }
}

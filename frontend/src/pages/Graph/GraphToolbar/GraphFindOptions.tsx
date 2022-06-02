import { Dropdown, DropdownToggle, DropdownItem } from '@patternfly/react-core';
import * as React from 'react';
import { KialiIcon } from 'config/KialiIcon';
import { serverConfig } from 'config';
import { style } from 'typestyle';

type FindKind = 'find' | 'hide';

type GraphFindOptionsProps = {
  kind: FindKind;
  onSelect: (expression) => void;
};

type GraphFindOptionsState = { isOpen: boolean };

const dropdown = style({
  minWidth: '20px',
  width: '20px',
  paddingLeft: '5px',
  paddingRight: 0,
  bottom:  '0.5px'
});

export class GraphFindOptions extends React.PureComponent<GraphFindOptionsProps, GraphFindOptionsState> {
  options: React.ReactFragment[];

  constructor(props: GraphFindOptionsProps) {
    super(props);

    this.options = this.getOptionItems(props.kind);

    this.state = {
      isOpen: false
    };
  }

  render() {
    return (
      <Dropdown
        key={`graph-${this.props.kind}-presets`}
        id={`graph-${this.props.kind}-presets`}
        toggle={
          <DropdownToggle
            data-test={`${this.props.kind}-options-dropdown`}
            className={dropdown}
            toggleIndicator={null}
            onToggle={this.onToggle}
          >
            <KialiIcon.AngleDown />
          </DropdownToggle>
        }
        isOpen={this.state.isOpen}
        dropdownItems={this.options}
        onSelect={this.close}
      ></Dropdown>
    );
  }

  private close = () => {
    this.setState({
      isOpen: false
    });
  };

  private getOptionItems = (kind: FindKind): React.ReactFragment[] => {
    const options =
      kind === 'find'
        ? serverConfig.kialiFeatureFlags.uiDefaults.graph.findOptions
        : serverConfig.kialiFeatureFlags.uiDefaults.graph.hideOptions;
    return options.map(o => {
      return (
        <DropdownItem key={o.description} onClick={() => this.props.onSelect(o.expression)}>
          {o.description}
        </DropdownItem>
      );
    });
  };

  private onToggle = isOpen => {
    this.setState({
      isOpen
    });
  };
}

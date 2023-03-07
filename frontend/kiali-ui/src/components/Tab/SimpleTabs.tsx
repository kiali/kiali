import * as React from 'react';
import { Tabs } from '@patternfly/react-core';

// SimpleTabs is just a Tabs wrapper than encapsulates the activeTab state handling such
// that parent components of Tabs don't have to re-render on a tab change.

type SimpleTabsProps = {
  defaultTab: number;
  id: string;
  isFilled?: boolean;
  mountOnEnter?: boolean;
  style?: React.CSSProperties;
  unmountOnExit?: boolean;
};

interface SimpleTabsState {
  activeTab: number;
}
export default class SimpleTabs extends React.Component<SimpleTabsProps, SimpleTabsState> {
  constructor(props: SimpleTabsProps) {
    super(props);
    this.state = { activeTab: props.defaultTab };
  }

  private handleTabSelect = (_, index) => {
    this.setState({ activeTab: index });
  };

  render() {
    return (
      <Tabs
        id={this.props.id}
        style={this.props.style ? this.props.style : {}}
        isFilled={this.props.isFilled ? this.props.isFilled : true}
        activeKey={this.state.activeTab}
        onSelect={this.handleTabSelect}
        mountOnEnter={this.props.mountOnEnter === undefined ? true : this.props.mountOnEnter}
        unmountOnExit={this.props.unmountOnExit === undefined ? true : this.props.unmountOnExit}
      >
        {this.props.children}
      </Tabs>
    );
  }
}

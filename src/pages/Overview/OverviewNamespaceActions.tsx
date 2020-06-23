import * as React from 'react';
import { Dropdown, DropdownItem, DropdownSeparator, KebabToggle } from '@patternfly/react-core';

export type OverviewNamespaceAction = {
  isSeparator: boolean;
  title?: string;
  action?: (namespace: string) => void;
};

type Props = {
  namespace: string;
  actions: OverviewNamespaceAction[];
};

type State = {
  isKebabOpen: boolean;
};

export class OverviewNamespaceActions extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isKebabOpen: false
    };
  }

  onKebabToggle = (isOpen: boolean) => {
    this.setState({
      isKebabOpen: isOpen
    });
  };

  render() {
    const namespaceActions = this.props.actions.map((action, i) => {
      if (action.isSeparator) {
        return <DropdownSeparator key={'separator_' + i} />;
      } else if (action.title && action.action) {
        return (
          <DropdownItem
            key={'action_' + i}
            onClick={() => (action.action ? action.action(this.props.namespace) : undefined)}
          >
            {action.title}
          </DropdownItem>
        );
      }
      return undefined;
    });
    return (
      <Dropdown
        toggle={<KebabToggle onToggle={this.onKebabToggle} />}
        dropdownItems={namespaceActions}
        isPlain={true}
        isOpen={this.state.isKebabOpen}
        position={'right'}
      />
    );
  }
}

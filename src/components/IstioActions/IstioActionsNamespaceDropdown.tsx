import * as React from 'react';
import { Dropdown, DropdownItem, DropdownPosition, DropdownToggle } from '@patternfly/react-core';
import history from '../../app/History';
import { serverConfig } from '../../config';

type Props = {};

type State = {
  dropdownOpen: boolean;
};

class IstioActionsNamespaceDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      dropdownOpen: false
    };
  }

  onSelect = _ => {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen
    });
  };

  onToggle = (dropdownState: boolean) => {
    this.setState({
      dropdownOpen: dropdownState
    });
  };

  onClickCreate = () => {
    history.push('/istio/new');
  };

  onClickThreeScale = () => {
    history.push('/extensions/threescale/new?namespaces=' + serverConfig.istioNamespace);
  };

  render() {
    const dropdownItems = [
      <DropdownItem key="createIstioConfig" onClick={this.onClickCreate}>
        Create New Istio Config
      </DropdownItem>
    ];
    // 3scale actions are now located under Istio Config actions
    if (serverConfig.extensions!.threescale!.enabled) {
      dropdownItems.push(
        <DropdownItem key="createThreeScaleConfig" onClick={this.onClickThreeScale}>
          Create New 3scale Config
        </DropdownItem>
      );
    }
    return (
      <Dropdown
        id="actions"
        title="Actions"
        toggle={<DropdownToggle onToggle={this.onToggle}>Actions</DropdownToggle>}
        onSelect={this.onSelect}
        position={DropdownPosition.right}
        isOpen={this.state.dropdownOpen}
        dropdownItems={dropdownItems}
      />
    );
  }
}

export default IstioActionsNamespaceDropdown;

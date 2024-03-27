import * as React from 'react';
import { Dropdown, DropdownGroup, DropdownItem, DropdownPosition, DropdownToggle } from '@patternfly/react-core';
import { history } from '../../app/History';
import { serverConfig } from '../../config';
import { NEW_ISTIO_RESOURCE } from '../../pages/IstioConfigNew/IstioConfigNewPage';
import { K8SGATEWAY } from '../../pages/IstioConfigNew/K8sGatewayForm';
import { groupMenuStyle } from 'styles/DropdownStyles';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';
import { store } from 'store/ConfigStore';

type Props = {};

type State = {
  dropdownOpen: boolean;
};

type ActionItem = {
  name: string;
  action: JSX.Element;
};

export class IstioActionsNamespaceDropdown extends React.Component<Props, State> {
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

  onClickCreate = (type: string) => {
    const kiosk = store.getState().globalState.kiosk;
    const newUrl = `/istio/new/${type}`;

    if (isParentKiosk(kiosk)) {
      kioskContextMenuAction(newUrl);
    } else {
      history.push(newUrl);
    }
  };

  render() {
    const dropdownItemsRaw = NEW_ISTIO_RESOURCE.map(
      (r): ActionItem => ({
        name: r.value,
        action: (
          <DropdownItem
            key={'createIstioConfig_' + r.value}
            isDisabled={r.value === K8SGATEWAY ? !serverConfig.gatewayAPIEnabled : r.disabled}
            onClick={() => this.onClickCreate(r.value)}
            data-test={'create_' + r.label}
          >
            {r.label}
          </DropdownItem>
        )
      })
    );

    const dropdownItems = [
      <DropdownGroup
        key={'group_create'}
        label={'Create'}
        className={groupMenuStyle}
        children={dropdownItemsRaw.map(r => r.action)}
      />
    ];
    return (
      <Dropdown
        data-test="actions-dropdown"
        id="actions"
        toggle={
          <DropdownToggle onToggle={this.onToggle} data-test="config-actions-dropdown">
            Actions
          </DropdownToggle>
        }
        onSelect={this.onSelect}
        position={DropdownPosition.right}
        isOpen={this.state.dropdownOpen}
        dropdownItems={dropdownItems}
      />
    );
  }
}

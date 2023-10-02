import * as React from 'react';
import { history } from '../../app/History';
import { serverConfig } from '../../config';
import { NEW_ISTIO_RESOURCE } from '../../pages/IstioConfigNew/IstioConfigNewPage';
import { K8SGATEWAY } from '../../pages/IstioConfigNew/K8sGatewayForm';
import { groupMenuStyle } from 'styles/DropdownStyles';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement
} from '@patternfly/react-core';

type ActionItem = {
  name: string;
  action: JSX.Element;
};

export const IstioActionsNamespaceDropdown: React.FC = () => {
  const [dropdownOpen, setDropdownOpen] = React.useState<boolean>(false);

  const onToggle = (dropdownState: boolean) => {
    setDropdownOpen(dropdownState);
  };

  const onClickCreate = (type: string) => {
    history.push('/istio/new/' + type);
  };

  const dropdownItemsRaw = NEW_ISTIO_RESOURCE.map(
    (r): ActionItem => ({
      name: r.value,
      action: (
        <DropdownItem
          key={'createIstioConfig_' + r.value}
          isDisabled={r.value === K8SGATEWAY ? !serverConfig.gatewayAPIEnabled : r.disabled}
          onClick={() => onClickCreate(r.value)}
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
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => onToggle(!dropdownOpen)}
          data-test="config-actions-dropdown"
          isExpanded={dropdownOpen}
        >
          Actions
        </MenuToggle>
      )}
      isOpen={dropdownOpen}
      onOpenChange={(isOpen: boolean) => onToggle(isOpen)}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>{dropdownItems}</DropdownList>
    </Dropdown>
  );
};

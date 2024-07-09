import * as React from 'react';
import { serverConfig } from '../../config';
import { NEW_ISTIO_RESOURCE } from '../../pages/IstioConfigNew/IstioConfigNewPage';
import { K8SGATEWAY } from '../../pages/IstioConfigNew/K8sGatewayForm';
import { K8S_REFERENCE_GRANT } from '../../pages/IstioConfigNew/K8sReferenceGrantForm';
import { groupMenuStyle } from 'styles/DropdownStyles';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement
} from '@patternfly/react-core';
import { useKialiSelector } from 'hooks/redux';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';
import { useKialiTranslation } from 'utils/I18nUtils';
import { useNavigate } from 'react-router-dom-v5-compat';

type ActionItem = {
  action: React.ReactElement;
  name: string;
};

export const IstioActionsNamespaceDropdown: React.FC = () => {
  const kiosk = useKialiSelector(state => state.globalState.kiosk);
  const { t } = useKialiTranslation();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = React.useState<boolean>(false);

  const onSelect = (): void => {
    setDropdownOpen(!dropdownOpen);
  };

  const onToggle = (dropdownState: boolean): void => {
    setDropdownOpen(dropdownState);
  };

  const onClickCreate = (type: string): void => {
    const newUrl = `/istio/new/${type}`;

    if (isParentKiosk(kiosk)) {
      kioskContextMenuAction(newUrl);
    } else {
      navigate(newUrl);
    }
  };

  const dropdownItemsRaw = NEW_ISTIO_RESOURCE.map(
    (r): ActionItem => ({
      name: r.value,
      action: (
        <DropdownItem
          key={`createIstioConfig_${r.value}`}
          isDisabled={
            r.value === K8SGATEWAY || r.value === K8S_REFERENCE_GRANT ? !serverConfig.gatewayAPIEnabled : r.disabled
          }
          onClick={() => onClickCreate(r.value)}
          data-test={`create_${r.label}`}
        >
          {r.label}
        </DropdownItem>
      )
    })
  );

  const dropdownItems = [
    <DropdownGroup
      key={'group_create'}
      label={t('Create')}
      className={groupMenuStyle}
      children={dropdownItemsRaw.map(r => r.action)}
    />
  ];

  return (
    <Dropdown
      data-test="istio-actions-dropdown"
      id="actions"
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          id="actions-toggle"
          onClick={() => onToggle(!dropdownOpen)}
          data-test="istio-actions-toggle"
          isExpanded={dropdownOpen}
        >
          {t('Actions')}
        </MenuToggle>
      )}
      isOpen={dropdownOpen}
      onOpenChange={(isOpen: boolean) => onToggle(isOpen)}
      onSelect={onSelect}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>{dropdownItems}</DropdownList>
    </Dropdown>
  );
};

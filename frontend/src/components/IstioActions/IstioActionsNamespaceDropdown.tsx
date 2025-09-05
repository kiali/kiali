import * as React from 'react';
import { serverConfig } from '../../config';
import { NEW_ISTIO_RESOURCE } from '../../pages/IstioConfigNew/IstioConfigNewPage';
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
import { GroupVersionKind } from '../../types/IstioObjects';
import { kindToStringIncludeK8s } from '../../utils/IstioConfigUtils';

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

  const onClickCreate = (gvk: GroupVersionKind): void => {
    const newUrl = `/istio/new/${gvk.Group}/${gvk.Version}/${gvk.Kind}`;

    if (isParentKiosk(kiosk)) {
      kioskContextMenuAction(newUrl);
    } else {
      navigate(newUrl);
    }
  };

  const isDisabled = (label: string, disabled: boolean): boolean => {
    if (label.includes('K8s')) {
      return !serverConfig.gatewayAPIEnabled;
    } else if (label === t('Gateway')) {
      return !serverConfig.ingressGatewayInstalled;
    } else if (label === t('ServiceEntry') || label === t('Sidecar')) {
      return !serverConfig.istioAPIInstalled;
    } else {
      return disabled;
    }
  };

  const dropdownItemsRaw = NEW_ISTIO_RESOURCE.map(
    (r): ActionItem => {
      const label = kindToStringIncludeK8s(r.value.Group, r.value.Kind);
      return {
        name: label,
        action: (
          <DropdownItem
            key={`createIstioConfig_${label}`}
            isDisabled={isDisabled(label, r.disabled)}
            onClick={() => onClickCreate(r.value)}
            data-test={`create_${label}`}
          >
            {label}
          </DropdownItem>
        )
      };
    }
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

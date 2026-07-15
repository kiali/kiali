import * as React from 'react';
import { serverConfig } from '../../config';
import { NEW_ISTIO_RESOURCE } from '../../pages/IstioConfigNew/IstioConfigNewPage';
import { groupMenuStyle } from 'styles/DropdownStyles';
import type { MenuToggleElement } from '@patternfly/react-core';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
  TooltipPosition
} from '@patternfly/react-core';
import { useKialiSelector } from 'hooks/redux';
import { isParentKiosk, kioskNavigateAction } from 'components/Kiosk/KioskActions';
import { useKialiTranslation } from 'utils/I18nUtils';
import { useNavigate } from 'react-router';
import type { GroupVersionKind } from '../../types/IstioObjects';
import { kindToStringIncludeK8s } from '../../utils/IstioConfigUtils';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';

type ActionItem = {
  action: React.ReactElement;
  name: string;
};

export const IstioActionsNamespaceDropdown: React.FC = () => {
  const kiosk = useKialiSelector(state => state.globalState.kiosk);
  const { t } = useKialiTranslation();
  const navigate = useNavigate();
  const viewOnly = serverConfig.deployment.viewOnlyMode;

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
      kioskNavigateAction(newUrl);
    } else {
      navigate(newUrl);
    }
  };

  const isDisabled = (label: string, disabled: boolean): boolean => {
    if (label.includes('K8s')) {
      return !serverConfig.gatewayAPIEnabled;
    } else if (label === t('Gateway')) {
      return !serverConfig.istioGatewayInstalled;
    } else if (label === t('ServiceEntry') || label === t('Sidecar')) {
      return !serverConfig.istioAPIInstalled;
    } else {
      return disabled;
    }
  };

  const dropdownItemsRaw = NEW_ISTIO_RESOURCE.map(
    (r): ActionItem => {
      const label = kindToStringIncludeK8s(r.value.Group, r.value.Kind);
      const isActionDisabled = isDisabled(label, r.disabled);
      const createAction = (
        <DropdownItem
          key={`createIstioConfig_${label}`}
          isDisabled={isActionDisabled || viewOnly}
          onClick={() => onClickCreate(r.value)}
          data-test={`create_${label}`}
        >
          {label}
        </DropdownItem>
      );
      return {
        name: label,
        action:
          viewOnly && !isActionDisabled
            ? renderDisabledDropdownOption(
                `createIstioConfig_${label}`,
                TooltipPosition.left,
                t('No user permission or Kiali in view-only mode'),
                createAction
              )
            : createAction
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

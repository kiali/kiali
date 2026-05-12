import * as React from 'react';
import { DropdownList, MenuToggle, MenuToggleElement, TooltipPosition } from '@patternfly/react-core';
import { Dropdown } from '@patternfly/react-core';
import { serverConfig } from '../../config';
import { Workload } from '../../types/Workload';
import {
  WIZARD_DISABLE_AUTO_INJECTION,
  WIZARD_ENABLE_AUTO_INJECTION,
  WIZARD_REMOVE_AUTO_INJECTION
} from './WizardActions';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';
import { WorkloadWizardActionsDropdownGroup } from './WorkloadWizardActionsDropdownGroup';
import { t } from 'utils/I18nUtils';
import { isGVKSupported } from '../../utils/IstioConfigUtils';

interface Props {
  namespace: string;
  onChange?: () => void;
  workload: Workload;
}

export const WorkloadWizardDropdown: React.FC<Props> = (props: Props) => {
  const [isActionsOpen, setIsActionsOpen] = React.useState<boolean>(false);

  const onActionsSelect = (): void => {
    setIsActionsOpen(!isActionsOpen);
  };

  const onActionsToggle = (isOpen: boolean): void => {
    setIsActionsOpen(isOpen);
  };

  const onAction = (key: string): void => {
    switch (key) {
      case WIZARD_ENABLE_AUTO_INJECTION:
      case WIZARD_DISABLE_AUTO_INJECTION:
      case WIZARD_REMOVE_AUTO_INJECTION: {
        if (props.onChange) {
          props.onChange();
        }

        break;
      }
      default:
        console.log('Unrecognized key');
    }
  };

  const validActions = serverConfig.kialiFeatureFlags.istioInjectionAction && !props.workload.isAmbient;

  const supportedWorkload = isGVKSupported(props.workload.gvk);

  const dropdown = (
    <Dropdown
      data-test="workload-actions-dropdown"
      id="actions"
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          id="actions-toggle"
          onClick={() => onActionsToggle(!isActionsOpen)}
          data-test="workload-actions-toggle"
          isExpanded={isActionsOpen}
          isDisabled={!validActions || !supportedWorkload}
        >
          {t('Actions')}
        </MenuToggle>
      )}
      isOpen={isActionsOpen}
      onOpenChange={(isOpen: boolean) => onActionsToggle(isOpen)}
      onSelect={onActionsSelect}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>
        <WorkloadWizardActionsDropdownGroup
          actionsLabel={false}
          namespace={props.namespace}
          onAction={onAction}
          workload={props.workload}
        ></WorkloadWizardActionsDropdownGroup>
      </DropdownList>
    </Dropdown>
  );
  // TODO WorkloadWizard component contains only 3scale actions but in the future we may need to bring it back
  return (
    <>
      {!validActions
        ? renderDisabledDropdownOption(
            'tooltip_wizard_actions',
            TooltipPosition.top,
            t('No actions available on this Workload'),
            dropdown
          )
        : !supportedWorkload
        ? renderDisabledDropdownOption(
            'tooltip_wizard_actions',
            TooltipPosition.top,
            t('This type of workload is read-only'),
            dropdown
          )
        : dropdown}
    </>
  );
};

import * as React from 'react';
import { DropdownList, MenuToggle, MenuToggleElement, TooltipPosition } from '@patternfly/react-core';
import { Dropdown } from '@patternfly/react-core';
import { serverConfig } from '../../config';
import { Workload } from '../../types/Workload';
import {
  buildAnnotationPatch,
  WIZARD_DISABLE_AUTO_INJECTION,
  WIZARD_ENABLE_AUTO_INJECTION,
  WIZARD_REMOVE_AUTO_INJECTION,
  WIZARD_EDIT_ANNOTATIONS
} from './WizardActions';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';
import { WizardLabels } from './WizardLabels';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';
import { WorkloadWizardActionsDropdownGroup } from './WorkloadWizardActionsDropdownGroup';
import { t } from 'utils/I18nUtils';
import { getGVKTypeString, isGVKSupported } from '../../utils/IstioConfigUtils';
import { gvkType } from '../../types/IstioConfigList';

interface Props {
  namespace: string;
  onChange?: () => void;
  workload: Workload;
}

export const WorkloadWizardDropdown: React.FC<Props> = (props: Props) => {
  const [isActionsOpen, setIsActionsOpen] = React.useState<boolean>(false);
  const [showWizard, setShowWizard] = React.useState<boolean>(false);

  const onActionsSelect = (): void => {
    setIsActionsOpen(!isActionsOpen);
  };

  const onActionsToggle = (isOpen: boolean): void => {
    setIsActionsOpen(isOpen);
  };

  const onWizardToggle = (isOpen: boolean): void => {
    setShowWizard(isOpen);
  };

  const onChangeAnnotations = (annotations: { [key: string]: string }): void => {
    const jsonInjectionPatch = buildAnnotationPatch(annotations);

    API.updateWorkload(
      props.namespace,
      props.workload.name,
      props.workload.gvk,
      jsonInjectionPatch,
      'json',
      props.workload.cluster
    )
      .then(_ => {
        AlertUtils.add(`Workload ${props.workload.name} updated`, 'default', MessageType.SUCCESS);
      })
      .catch(error => {
        AlertUtils.addError(`Could not update workload ${props.workload.name}`, error);
      })
      .finally(() => {
        setShowWizard(false);

        if (props.onChange) {
          props.onChange();
        }
      });
  };

  const onAction = (key: string): void => {
    switch (key) {
      case WIZARD_ENABLE_AUTO_INJECTION:
      case WIZARD_DISABLE_AUTO_INJECTION:
      case WIZARD_REMOVE_AUTO_INJECTION: {
        setShowWizard(false);

        if (props.onChange) {
          props.onChange();
        }

        break;
      }
      case WIZARD_EDIT_ANNOTATIONS: {
        onWizardToggle(true);
        break;
      }
      default:
        console.log('Unrecognized key');
    }
  };

  const validActions =
    //  istio actions
    (serverConfig.kialiFeatureFlags.istioInjectionAction && !props.workload.isAmbient) ||
    // annotations
    getGVKTypeString(props.workload.gvk) === getGVKTypeString(gvkType.Deployment);

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
          annotations={props.workload.annotations}
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
      <WizardLabels
        showAnotationsWizard={showWizard}
        type={'annotations'}
        onChange={annotations => onChangeAnnotations(annotations)}
        onClose={() => onWizardToggle(false)}
        labels={props.workload.annotations}
        canEdit={serverConfig.kialiFeatureFlags.istioAnnotationAction && !serverConfig.deployment.viewOnlyMode}
      />
      {!validActions
        ? renderDisabledDropdownOption(
            'tooltip_wizard_actions',
            TooltipPosition.top,
            t('User does not have permission on this Workload'),
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

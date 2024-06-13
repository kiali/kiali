import * as React from 'react';
import { DropdownList, MenuToggle, MenuToggleElement, TooltipPosition } from '@patternfly/react-core';
import { Dropdown, DropdownItem } from '@patternfly/react-core';
import { serverConfig } from '../../config';
import { Workload } from '../../types/Workload';
import {
  buildWorkloadInjectionPatch,
  buildAnnotationPatch,
  WIZARD_DISABLE_AUTO_INJECTION,
  WIZARD_ENABLE_AUTO_INJECTION,
  WIZARD_REMOVE_AUTO_INJECTION,
  WIZARD_EDIT_ANNOTATIONS
} from './WizardActions';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';
import { StatusState } from '../../types/StatusState';
import { WizardLabels } from './WizardLabels';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';

interface Props {
  namespace: string;
  onChange: () => void;
  statusState: StatusState;
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

  const onAction = (key: string): void => {
    switch (key) {
      case WIZARD_ENABLE_AUTO_INJECTION:
      case WIZARD_DISABLE_AUTO_INJECTION:
      case WIZARD_REMOVE_AUTO_INJECTION:
        const remove = key === WIZARD_REMOVE_AUTO_INJECTION;
        const enable = key === WIZARD_ENABLE_AUTO_INJECTION;
        const jsonInjectionPatch = buildWorkloadInjectionPatch(props.workload.type, enable, remove);
        API.updateWorkload(
          props.namespace,
          props.workload.name,
          props.workload.type,
          jsonInjectionPatch,
          undefined,
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
            props.onChange();
          });
        break;
      default:
        console.warn(`WorkloadWizardDropdown: key ${key} not supported`);
    }
  };

  const onChangeAnnotations = (annotations: { [key: string]: string }): void => {
    const jsonInjectionPatch = buildAnnotationPatch(annotations);

    API.updateWorkload(
      props.namespace,
      props.workload.name,
      props.workload.type,
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
        props.onChange();
      });
  };

  const renderDropdownItems = (): JSX.Element[] => {
    const items: JSX.Element[] = [];

    if (serverConfig.kialiFeatureFlags.istioInjectionAction && !props.workload.istioAmbient) {
      const enableAction = (
        <DropdownItem
          data-test={WIZARD_ENABLE_AUTO_INJECTION}
          key={WIZARD_ENABLE_AUTO_INJECTION}
          component="button"
          onClick={() => onAction(WIZARD_ENABLE_AUTO_INJECTION)}
          isDisabled={serverConfig.deployment.viewOnlyMode}
        >
          Enable Auto Injection
        </DropdownItem>
      );

      const enableActionWrapper = serverConfig.deployment.viewOnlyMode
        ? renderDisabledDropdownOption(
            'enable_auto_injection',
            TooltipPosition.left,
            'User does not have permission',
            enableAction
          )
        : enableAction;

      const disableAction = (
        <DropdownItem
          data-test={WIZARD_DISABLE_AUTO_INJECTION}
          key={WIZARD_DISABLE_AUTO_INJECTION}
          component="button"
          onClick={() => onAction(WIZARD_DISABLE_AUTO_INJECTION)}
          isDisabled={serverConfig.deployment.viewOnlyMode}
        >
          Disable Auto Injection
        </DropdownItem>
      );

      const disableActionWrapper = serverConfig.deployment.viewOnlyMode
        ? renderDisabledDropdownOption(
            'disable_auto_injection',
            TooltipPosition.left,
            'User does not have permission',
            disableAction
          )
        : disableAction;

      const removeAction = (
        <DropdownItem
          data-test={WIZARD_REMOVE_AUTO_INJECTION}
          key={WIZARD_REMOVE_AUTO_INJECTION}
          component="button"
          onClick={() => onAction(WIZARD_REMOVE_AUTO_INJECTION)}
          isDisabled={serverConfig.deployment.viewOnlyMode}
        >
          Remove Auto Injection
        </DropdownItem>
      );

      const removeActionWrapper = serverConfig.deployment.viewOnlyMode
        ? renderDisabledDropdownOption(
            'remove_auto_injection',
            TooltipPosition.left,
            'User does not have permission',
            removeAction
          )
        : removeAction;

      if (props.workload.istioInjectionAnnotation !== undefined && props.workload.istioInjectionAnnotation) {
        items.push(disableActionWrapper);
        items.push(removeActionWrapper);
      } else if (props.workload.istioInjectionAnnotation !== undefined && !props.workload.istioInjectionAnnotation) {
        items.push(enableActionWrapper);
        items.push(removeActionWrapper);
      } else {
        // If sidecar is present, we offer first the disable action
        items.push(props.workload.istioSidecar ? disableActionWrapper : enableActionWrapper);
      }
    }

    if (props.workload.type === 'Deployment') {
      const annotationsAction = (
        <DropdownItem
          data-test={WIZARD_EDIT_ANNOTATIONS}
          key={WIZARD_EDIT_ANNOTATIONS}
          component="button"
          onClick={() => onWizardToggle(true)}
        >
          {serverConfig.kialiFeatureFlags.istioAnnotationAction && !serverConfig.deployment.viewOnlyMode
            ? 'Edit Annotations'
            : 'View Annotations'}
        </DropdownItem>
      );

      items.push(annotationsAction);
    }
    return items;
  };

  const dropdownItems = renderDropdownItems();
  const validActions = dropdownItems.length > 0;

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
          isDisabled={!validActions}
        >
          Actions
        </MenuToggle>
      )}
      isOpen={isActionsOpen}
      onOpenChange={(isOpen: boolean) => onActionsToggle(isOpen)}
      onSelect={onActionsSelect}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>{dropdownItems}</DropdownList>
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
            'User does not have permission on this Workload',
            dropdown
          )
        : dropdown}
    </>
  );
};

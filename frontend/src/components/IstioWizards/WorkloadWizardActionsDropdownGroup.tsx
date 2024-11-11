import * as React from 'react';
import { DropdownGroup, DropdownItem, TooltipPosition } from '@patternfly/react-core';
import { serverConfig } from 'config';
import {
  buildWorkloadInjectionPatch,
  WIZARD_DISABLE_AUTO_INJECTION,
  WIZARD_EDIT_ANNOTATIONS,
  WIZARD_ENABLE_AUTO_INJECTION,
  WIZARD_REMOVE_AUTO_INJECTION
} from './WizardActions';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { Workload } from 'types/Workload';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';
import { MessageType } from 'types/MessageCenter';
import { groupMenuStyle } from 'styles/DropdownStyles';
import { t } from 'utils/I18nUtils';
import { getGVKTypeString } from '../../utils/IstioConfigUtils';

type Props = {
  actionsLabel: boolean;
  annotations?: { [key: string]: string };
  namespace: string;
  onAction: (key: string) => void;
  workload: Workload;
};

export const WorkloadWizardActionsDropdownGroup: React.FunctionComponent<Props> = (props: Props) => {
  const actionItems: React.ReactNode[] = [];

  const onAction = (key: string): void => {
    switch (key) {
      case WIZARD_ENABLE_AUTO_INJECTION:
      case WIZARD_DISABLE_AUTO_INJECTION:
      case WIZARD_REMOVE_AUTO_INJECTION:
        const remove = key === WIZARD_REMOVE_AUTO_INJECTION;
        const enable = key === WIZARD_ENABLE_AUTO_INJECTION;
        const jsonInjectionPatch = buildWorkloadInjectionPatch(props.workload.gvk, enable, remove);
        API.updateWorkload(
          props.namespace,
          props.workload.name,
          props.workload.gvk,
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
            props.onAction(key);
          });
        break;
      case WIZARD_EDIT_ANNOTATIONS: {
        props.onAction(key);
        break;
      }
      default:
        console.warn(`WorkloadWizardDropdown: key ${key} not supported`);
    }
  };

  if (serverConfig.kialiFeatureFlags.istioInjectionAction && !props.workload.isAmbient) {
    const enableAction = (
      <DropdownItem
        data-test={WIZARD_ENABLE_AUTO_INJECTION}
        key={WIZARD_ENABLE_AUTO_INJECTION}
        component="button"
        onClick={() => onAction(WIZARD_ENABLE_AUTO_INJECTION)}
        isDisabled={serverConfig.deployment.viewOnlyMode}
      >
        {t('Enable Auto Injection')}
      </DropdownItem>
    );

    const enableActionWrapper = serverConfig.deployment.viewOnlyMode
      ? renderDisabledDropdownOption(
          'enable_auto_injection',
          TooltipPosition.left,
          t('User does not have permission'),
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
        {t('Disable Auto Injection')}
      </DropdownItem>
    );

    const disableActionWrapper = serverConfig.deployment.viewOnlyMode
      ? renderDisabledDropdownOption(
          'disable_auto_injection',
          TooltipPosition.left,
          t('User does not have permission'),
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
        {t('Remove Auto Injection')}
      </DropdownItem>
    );

    const removeActionWrapper = serverConfig.deployment.viewOnlyMode
      ? renderDisabledDropdownOption(
          'remove_auto_injection',
          TooltipPosition.left,
          t('User does not have permission'),
          removeAction
        )
      : removeAction;

    if (props.workload.istioInjectionAnnotation !== undefined && props.workload.istioInjectionAnnotation) {
      actionItems.push(disableActionWrapper);
      actionItems.push(removeActionWrapper);
    } else if (props.workload.istioInjectionAnnotation !== undefined && !props.workload.istioInjectionAnnotation) {
      actionItems.push(enableActionWrapper);
      actionItems.push(removeActionWrapper);
    } else {
      // If sidecar is present, we offer first the disable action
      actionItems.push(props.workload.istioSidecar ? disableActionWrapper : enableActionWrapper);
    }
  }

  // Annotations
  if (props.annotations && getGVKTypeString(props.workload.gvk) === getGVKTypeString('Deployment')) {
    const annotationsAction = (
      <DropdownItem
        data-test={WIZARD_EDIT_ANNOTATIONS}
        key={WIZARD_EDIT_ANNOTATIONS}
        component="button"
        onClick={() => onAction(WIZARD_EDIT_ANNOTATIONS)}
      >
        {serverConfig.kialiFeatureFlags.istioAnnotationAction && !serverConfig.deployment.viewOnlyMode
          ? t('Edit Annotations')
          : t('View Annotations')}
      </DropdownItem>
    );

    actionItems.push(annotationsAction);
  }

  if (props.actionsLabel && actionItems.length > 0) {
    return (
      <DropdownGroup key={`group_actions`} label={t('Actions')} className={groupMenuStyle} children={actionItems} />
    );
  } else {
    return <>{actionItems}</>;
  }
};

import * as React from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { CaretDownIcon } from '@patternfly/react-icons';
import { serverConfig } from '../../config';
import { Workload } from '../../types/Workload';
import {
  buildWorkloadInjectionPatch,
  WIZARD_DISABLE_AUTO_INJECTION,
  WIZARD_ENABLE_AUTO_INJECTION,
  WIZARD_REMOVE_AUTO_INJECTION
} from './WizardActions';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';
import { StatusState } from '../../types/StatusState';

interface Props {
  namespace: string;
  workload: Workload;
  statusState: StatusState;
  onChange: () => void;
}

interface State {
  isActionsOpen: boolean;
  showWizard: boolean;
  type: string;
}

class WorkloadWizardDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isActionsOpen: false,
      showWizard: false,
      type: ''
    };
  }

  onActionsSelect = () => {
    this.setState({
      isActionsOpen: !this.state.isActionsOpen
    });
  };

  onActionsToggle = (isOpen: boolean) => {
    this.setState({
      isActionsOpen: isOpen
    });
  };

  onWizardToggle = (isOpen: boolean) => {
    this.setState({
      showWizard: isOpen
    });
  };

  onAction = (key: string) => {
    switch (key) {
      case WIZARD_ENABLE_AUTO_INJECTION:
      case WIZARD_DISABLE_AUTO_INJECTION:
      case WIZARD_REMOVE_AUTO_INJECTION:
        const remove = key === WIZARD_REMOVE_AUTO_INJECTION;
        const enable = key === WIZARD_ENABLE_AUTO_INJECTION;
        const jsonInjectionPatch = buildWorkloadInjectionPatch(
          this.props.workload.type,
          enable,
          remove,
          this.props.statusState
        );
        API.updateWorkload(this.props.namespace, this.props.workload.name, this.props.workload.type, jsonInjectionPatch)
          .then(_ => {
            AlertUtils.add('Workload ' + this.props.workload.name + ' updated', 'default', MessageType.SUCCESS);
            this.setState(
              {
                showWizard: false
              },
              () => this.props.onChange()
            );
          })
          .catch(error => {
            AlertUtils.addError('Could not update workload ' + this.props.workload.name, error);
            this.setState(
              {
                showWizard: false
              },
              () => this.props.onChange()
            );
          });
        break;
      default:
        console.log('key ' + key + ' not supported');
    }
  };

  onClose = (changed?: boolean) => {
    this.setState({ showWizard: false });
    if (changed) {
      this.props.onChange();
    }
  };

  renderTooltip = (key, position, msg, child): JSX.Element => {
    return (
      <Tooltip key={'tooltip_' + key} position={position} content={<>{msg}</>}>
        <div style={{ display: 'inline-block', cursor: 'not-allowed', textAlign: 'left' }}>{child}</div>
      </Tooltip>
    );
  };

  renderDropdownItems = (): JSX.Element[] => {
    const items: JSX.Element[] = [];
    if (serverConfig.kialiFeatureFlags.istioInjectionAction) {
      const enableAction = (
        <DropdownItem
          key={WIZARD_ENABLE_AUTO_INJECTION}
          component="button"
          onClick={() => this.onAction(WIZARD_ENABLE_AUTO_INJECTION)}
          isDisabled={serverConfig.deployment.viewOnlyMode}
        >
          Enable Auto Injection
        </DropdownItem>
      );
      const enableActionWrapper = serverConfig.deployment.viewOnlyMode
        ? this.renderTooltip(
            'enable_auto_injection',
            TooltipPosition.left,
            'User does not have permission',
            enableAction
          )
        : enableAction;

      const disableAction = (
        <DropdownItem
          key={WIZARD_DISABLE_AUTO_INJECTION}
          component="button"
          onClick={() => this.onAction(WIZARD_DISABLE_AUTO_INJECTION)}
          isDisabled={serverConfig.deployment.viewOnlyMode}
        >
          Disable Auto Injection
        </DropdownItem>
      );
      const disableActionWrapper = serverConfig.deployment.viewOnlyMode
        ? this.renderTooltip(
            'disable_auto_injection',
            TooltipPosition.left,
            'User does not have permission',
            disableAction
          )
        : disableAction;

      const removeAction = (
        <DropdownItem
          key={WIZARD_REMOVE_AUTO_INJECTION}
          component="button"
          onClick={() => this.onAction(WIZARD_REMOVE_AUTO_INJECTION)}
          isDisabled={serverConfig.deployment.viewOnlyMode}
        >
          Remove Auto Injection
        </DropdownItem>
      );
      const removeActionWrapper = serverConfig.deployment.viewOnlyMode
        ? this.renderTooltip(
            'remove_auto_injection',
            TooltipPosition.left,
            'User does not have permission',
            removeAction
          )
        : removeAction;

      if (this.props.workload.istioInjectionAnnotation !== undefined && this.props.workload.istioInjectionAnnotation) {
        items.push(disableActionWrapper);
        items.push(removeActionWrapper);
      } else if (
        this.props.workload.istioInjectionAnnotation !== undefined &&
        !this.props.workload.istioInjectionAnnotation
      ) {
        items.push(enableActionWrapper);
        items.push(removeActionWrapper);
      } else {
        // If sidecar is present, we offer first the disable action
        items.push(this.props.workload.istioSidecar ? disableActionWrapper : enableActionWrapper);
      }
    }
    return items;
  };

  render() {
    const renderDropdownItems = this.renderDropdownItems();
    const validActions = renderDropdownItems.length > 0;
    const dropdown = (
      <Dropdown
        position={DropdownPosition.right}
        onSelect={this.onActionsSelect}
        toggle={
          <DropdownToggle onToggle={this.onActionsToggle} icon={CaretDownIcon}>
            Actions
          </DropdownToggle>
        }
        isOpen={this.state.isActionsOpen}
        dropdownItems={this.renderDropdownItems()}
        disabled={!validActions}
        style={{ pointerEvents: validActions ? 'auto' : 'none' }}
      />
    );
    // TODO WorkloadWizard component contains only 3scale actions but in the future we may need to bring it back
    return (
      <>
        {!validActions
          ? this.renderTooltip(
              'tooltip_wizard_actions',
              TooltipPosition.top,
              'User does not have permission on this Workload',
              dropdown
            )
          : dropdown}
      </>
    );
  }
}

export default WorkloadWizardDropdown;

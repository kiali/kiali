import * as React from 'react';
import { Dropdown, DropdownItem, DropdownPosition, DropdownToggle } from '@patternfly/react-core';
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
import EnvoyDetailsModal from '../Envoy/EnvoyModal';

interface Props {
  namespace: string;
  workload: Workload;
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
        const jsonInjectionPatch = buildWorkloadInjectionPatch(this.props.workload.type, enable, remove);
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

  renderDropdownItems = (): JSX.Element[] => {
    const items: JSX.Element[] = [];
    if (serverConfig.kialiFeatureFlags.istioInjectionAction) {
      const enableAction = (
        <DropdownItem
          key={WIZARD_ENABLE_AUTO_INJECTION}
          component="button"
          onClick={() => this.onAction(WIZARD_ENABLE_AUTO_INJECTION)}
        >
          Enable Auto Injection
        </DropdownItem>
      );
      const disableAction = (
        <DropdownItem
          key={WIZARD_DISABLE_AUTO_INJECTION}
          component="button"
          onClick={() => this.onAction(WIZARD_DISABLE_AUTO_INJECTION)}
        >
          Disable Auto Injection
        </DropdownItem>
      );
      const removeAction = (
        <DropdownItem
          key={WIZARD_REMOVE_AUTO_INJECTION}
          component="button"
          onClick={() => this.onAction(WIZARD_REMOVE_AUTO_INJECTION)}
        >
          Remove Auto Injection
        </DropdownItem>
      );

      const envoyAction = (
        <DropdownItem
          key="envoy-details"
          component="button"
          onClick={() => this.onWizardToggle(true)}
          isDisabled={!this.props.workload.istioSidecar}
        >
          Show Envoy Details
        </DropdownItem>
      );

      if (this.props.workload.istioInjectionAnnotation !== undefined && this.props.workload.istioInjectionAnnotation) {
        items.push(disableAction);
        items.push(removeAction);
      } else if (
        this.props.workload.istioInjectionAnnotation !== undefined &&
        !this.props.workload.istioInjectionAnnotation
      ) {
        items.push(enableAction);
        items.push(removeAction);
      } else {
        // If sidecar is present, we offer first the disable action
        items.push(this.props.workload.istioSidecar ? disableAction : enableAction);
      }

      items.push(envoyAction);
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
          <DropdownToggle onToggle={this.onActionsToggle} iconComponent={CaretDownIcon}>
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
        {dropdown}
        <EnvoyDetailsModal
          namespace={this.props.namespace}
          workload={this.props.workload}
          show={this.state.showWizard}
          onClose={this.onClose}
        />
      </>
    );
  }
}

export default WorkloadWizardDropdown;

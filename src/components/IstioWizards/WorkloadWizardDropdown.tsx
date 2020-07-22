import * as React from 'react';
import { Dropdown, DropdownItem, DropdownPosition, DropdownToggle } from '@patternfly/react-core';
import { CaretDownIcon } from '@patternfly/react-icons';
import { serverConfig } from '../../config';
import { Workload } from '../../types/Workload';
import {
  buildWorkloadThreeScalePatch,
  isThreeScaleLinked,
  WIZARD_THREESCALE_LINK,
  WIZARD_THREESCALE_UNLINK
} from './WizardActions';
import WorkloadWizard from './WorkloadWizard';
import { IstioRule } from '../../types/IstioObjects';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';

interface Props {
  namespace: string;
  workload: Workload;
  rules: IstioRule[];
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

  onAction = (key: string) => {
    switch (key) {
      case WIZARD_THREESCALE_LINK:
        this.setState({
          showWizard: true,
          type: WIZARD_THREESCALE_LINK
        });
        break;
      case WIZARD_THREESCALE_UNLINK:
        const jsonPatch = buildWorkloadThreeScalePatch(false, this.props.workload.type, '', '');
        API.updateWorkload(this.props.namespace, this.props.workload.name, this.props.workload.type, jsonPatch)
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

  onClose = (changed: boolean) => {
    this.setState({ showWizard: false });
    if (changed) {
      this.props.onChange();
    }
  };

  renderDropdownItems = (): JSX.Element[] => {
    const items: JSX.Element[] = [];
    if (serverConfig.extensions?.threescale.enabled && this.props.workload) {
      if (isThreeScaleLinked(this.props.workload)) {
        items.push(
          <DropdownItem
            key={WIZARD_THREESCALE_UNLINK}
            component="button"
            onClick={() => this.onAction(WIZARD_THREESCALE_UNLINK)}
          >
            Unlink 3scale Authorization
          </DropdownItem>
        );
      } else {
        items.push(
          <DropdownItem
            key={WIZARD_THREESCALE_LINK}
            component="button"
            onClick={() => this.onAction(WIZARD_THREESCALE_LINK)}
          >
            Link 3scale Authorization
          </DropdownItem>
        );
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
    return (
      <>
        {dropdown}
        <WorkloadWizard
          show={this.state.showWizard}
          type={this.state.type}
          namespace={this.props.namespace}
          workload={this.props.workload}
          rules={this.props.rules}
          onClose={this.onClose}
        />
      </>
    );
  }
}

export default WorkloadWizardDropdown;

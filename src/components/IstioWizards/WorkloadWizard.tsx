import * as React from 'react';
import {
  buildWorkloadThreeScalePatch,
  WIZARD_THREESCALE_LINK,
  WIZARD_TITLES,
  WorkloadWizardProps,
  WorkloadWizardState
} from './WizardActions';
import { Button, Modal } from '@patternfly/react-core';
import ThreeScaleCredentials, { ThreeScaleCredentialsState } from './ThreeScaleCredentials';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';

class WorkloadWizard extends React.Component<WorkloadWizardProps, WorkloadWizardState> {
  constructor(props: WorkloadWizardProps) {
    super(props);
    this.state = {
      showWizard: false,
      valid: {
        threescale: false
      },
      threeScale: {
        serviceId: '',
        credentials: ''
      }
    };
  }

  componentDidUpdate(prevProps: WorkloadWizardProps) {
    if (prevProps.show !== this.props.show) {
      this.setState({
        showWizard: this.props.show
      });
    }
  }

  onClose = (changed: boolean) => {
    this.setState(
      {
        showWizard: false,
        valid: {
          threescale: false
        },
        threeScale: {
          serviceId: '',
          credentials: ''
        }
      },
      () => this.props.onClose(changed)
    );
  };

  onCreateUpdate = () => {
    switch (this.props.type) {
      case WIZARD_THREESCALE_LINK:
        const jsonPatch = buildWorkloadThreeScalePatch(
          true,
          this.props.workload.type,
          this.state.threeScale.serviceId,
          this.state.threeScale.credentials
        );
        API.updateWorkload(this.props.namespace, this.props.workload.name, this.props.workload.type, jsonPatch)
          .then(_ => {
            AlertUtils.add('Workload ' + this.props.workload.name + ' updated', 'default', MessageType.SUCCESS);
            this.onClose(true);
          })
          .catch(error => {
            AlertUtils.addError('Could not update workload ' + this.props.workload.name, error);
            this.onClose(true);
          });
        break;
    }
  };

  onThreeScaleChange = (state: ThreeScaleCredentialsState) => {
    this.setState(prevState => {
      prevState.valid.threescale = state.serviceId.length > 0 && state.credentials.length > 0;
      prevState.threeScale.serviceId = state.serviceId;
      prevState.threeScale.credentials = state.credentials;
      return {
        threeScale: prevState.threeScale
      };
    });
  };

  isValid = (state: WorkloadWizardState): boolean => {
    return state.valid.threescale;
  };

  render() {
    return (
      <>
        <Modal
          width={'50%'}
          title={this.props.type.length > 0 ? WIZARD_TITLES[this.props.type] : ''}
          isOpen={this.state.showWizard}
          onClose={() => this.onClose(false)}
          actions={[
            <Button key="cancel" variant="secondary" onClick={() => this.onClose(false)}>
              Cancel
            </Button>,
            <Button
              isDisabled={!this.isValid(this.state)}
              key="confirm"
              variant="primary"
              onClick={this.onCreateUpdate}
            >
              {'Create'}
            </Button>
          ]}
        >
          {this.props.type === WIZARD_THREESCALE_LINK && (
            <ThreeScaleCredentials
              threeScaleRules={this.props.rules}
              threeScaleCredentials={this.state.threeScale}
              onChange={this.onThreeScaleChange}
            />
          )}
        </Modal>
      </>
    );
  }
}

export default WorkloadWizard;

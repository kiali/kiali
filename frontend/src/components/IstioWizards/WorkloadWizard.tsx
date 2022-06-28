import * as React from 'react';
import { WIZARD_TITLES, WorkloadWizardProps, WorkloadWizardState } from './WizardActions';
import { Button, ButtonVariant, Modal } from '@patternfly/react-core';

// NOTE: This class is not used but I will keep it in the repo as skeleton as we'll add again WorkloadWizards for other
class WorkloadWizard extends React.Component<WorkloadWizardProps, WorkloadWizardState> {
  constructor(props: WorkloadWizardProps) {
    super(props);
    this.state = {
      showWizard: false,
      valid: {}
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
        valid: {}
      },
      () => this.props.onClose(changed)
    );
  };

  onCreateUpdate = () => {
    switch (this.props.type) {
    }
  };

  isValid = (_state: WorkloadWizardState): boolean => {
    return true;
  };

  render() {
    return (
      <>
        <Modal
          width={'75%'}
          title={this.props.type.length > 0 ? WIZARD_TITLES[this.props.type] : ''}
          isOpen={this.state.showWizard}
          onClose={() => this.onClose(false)}
          actions={[
            <Button
              isDisabled={!this.isValid(this.state)}
              key="confirm"
              variant={ButtonVariant.primary}
              onClick={this.onCreateUpdate}
            >
              {'Create'}
            </Button>,
            <Button key="cancel" variant={ButtonVariant.secondary} onClick={() => this.onClose(false)}>
              Cancel
            </Button>
          ]}
        >
          <>Workload Wizard Skeleton</>
        </Modal>
      </>
    );
  }
}

export default WorkloadWizard;

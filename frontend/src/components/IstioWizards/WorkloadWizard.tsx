import * as React from 'react';
import { WIZARD_TITLES, WorkloadWizardProps, WorkloadWizardState } from './WizardActions';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { Modal } from '@patternfly/react-core/deprecated';
import { t } from 'utils/I18nUtils';

// NOTE: This class is not used but I will keep it in the repo as skeleton as we'll add again WorkloadWizards for other
export class WorkloadWizard extends React.Component<WorkloadWizardProps, WorkloadWizardState> {
  constructor(props: WorkloadWizardProps) {
    super(props);
    this.state = {
      showWizard: false,
      valid: {}
    };
  }

  componentDidUpdate(prevProps: WorkloadWizardProps): void {
    if (prevProps.show !== this.props.show) {
      this.setState({
        showWizard: this.props.show
      });
    }
  }

  onClose = (changed: boolean): void => {
    this.setState(
      {
        showWizard: false,
        valid: {}
      },
      () => this.props.onClose(changed)
    );
  };

  onCreateUpdate = (): void => {
    switch (this.props.type) {
    }
  };

  isValid = (_state: WorkloadWizardState): boolean => {
    return true;
  };

  render(): React.ReactElement {
    return (
      <>
        <Modal
          width={'75%'}
          title={this.props.type.length > 0 ? WIZARD_TITLES[this.props.type].modalTitle : ''}
          aria-label="workload wizard"
          isOpen={this.state.showWizard}
          onClose={() => this.onClose(false)}
          actions={[
            <Button
              isDisabled={!this.isValid(this.state)}
              key="confirm"
              variant={ButtonVariant.primary}
              onClick={this.onCreateUpdate}
            >
              {t('Create')}
            </Button>,
            <Button key="cancel" variant={ButtonVariant.secondary} onClick={() => this.onClose(false)}>
              {t('Cancel')}
            </Button>
          ]}
        >
          <>Workload Wizard Skeleton</>
        </Modal>
      </>
    );
  }
}

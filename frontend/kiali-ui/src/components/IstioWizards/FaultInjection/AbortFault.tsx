import * as React from 'react';
import { FormGroup, Switch, TextInput } from '@patternfly/react-core';
import { Abort } from '../../../types/IstioObjects';
import { HTTP_ABORT_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { isValid } from 'utils/Common';

type Props = {
  aborted: boolean;
  abort: Abort;
  isValid: boolean;
  onAbort: (aborted: boolean, abort: Abort) => void;
};

const httpStatusMsg = 'HTTP status code to use to abort the Http request.';

class AbortFault extends React.Component<Props> {
  render() {
    return (
      <>
        <FormGroup label="Add HTTP Abort" fieldId="abortSwitch">
          <Switch
            id="abortSwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.props.aborted}
            onChange={() => this.props.onAbort(!this.props.aborted, this.props.abort)}
          />
          <span>{wizardTooltip(HTTP_ABORT_TOOLTIP)}</span>
        </FormGroup>
        {this.props.aborted && (
          <FormGroup
            label="Abort Percentage"
            fieldId="abort-percentage"
            helperText="Percentage of requests to be aborted with the error code provided."
          >
            <TextInput
              value={this.props.abort.percentage?.value}
              id="abort-percentage"
              name="abort-percentage"
              onChange={value => {
                let newValue = Number(value || 0);
                newValue = Number.isNaN(newValue) ? 0 : newValue;
                newValue = newValue < 0 ? 0 : newValue > 100 ? 100 : newValue;
                this.props.onAbort(this.props.aborted, {
                  percentage: {
                    value: newValue
                  },
                  httpStatus: this.props.abort.httpStatus
                });
              }}
            />
          </FormGroup>
        )}
        {this.props.aborted && (
          <FormGroup
            label="HTTP Status Code"
            fieldId="abort-status-code"
            helperText={httpStatusMsg}
            helperTextInvalid={httpStatusMsg}
            validated={isValid(this.props.isValid)}
          >
            <TextInput
              value={this.props.abort.httpStatus}
              id="abort-status-code"
              name="abort-status-code"
              validated={isValid(this.props.isValid)}
              onChange={value => {
                let newValue = Number(value || 0);
                newValue = Number.isNaN(newValue) ? 0 : newValue;
                this.props.onAbort(this.props.aborted, {
                  percentage: this.props.abort.percentage,
                  httpStatus: newValue
                });
              }}
            />
          </FormGroup>
        )}
      </>
    );
  }
}

export default AbortFault;

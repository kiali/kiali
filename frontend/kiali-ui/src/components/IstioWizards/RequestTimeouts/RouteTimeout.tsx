import * as React from 'react';
import { FormGroup, Switch, TextInput } from '@patternfly/react-core';
import { HTTP_TIMEOUT_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { isValid } from 'utils/Common';

export type RouteTimeoutProps = {
  isTimeout: boolean;
  timeout: string;
  isValid: boolean;
  onTimeout: (isTimeout: boolean, timeout: string) => void;
};

const timeoutMsg = 'Timeout for HTTP requests. Format: 1h/1m/1s/1ms. MUST be >=1ms.';

class RouteTimeout extends React.Component<RouteTimeoutProps> {
  render() {
    return (
      <>
        <FormGroup label="Add HTTP Timeout" fieldId="timeoutSwitch">
          <Switch
            id="timeoutSwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.props.isTimeout}
            onChange={() => this.props.onTimeout(!this.props.isTimeout, this.props.timeout)}
          />
          <span>{wizardTooltip(HTTP_TIMEOUT_TOOLTIP)}</span>
        </FormGroup>
        {this.props.isTimeout && (
          <FormGroup
            label="Timeout"
            fieldId="timeout-value"
            helperText={timeoutMsg}
            helperTextInvalid={timeoutMsg}
            validated={isValid(this.props.isValid)}
          >
            <TextInput
              value={this.props.timeout}
              type="text"
              id="timeout-value"
              name="timeout-value"
              onChange={value => this.props.onTimeout(this.props.isTimeout, value)}
            />
          </FormGroup>
        )}
      </>
    );
  }
}

export default RouteTimeout;

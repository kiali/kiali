import * as React from 'react';
import { FormGroup, Switch, TextInput } from '@patternfly/react-core';
import { Delay } from '../../../types/IstioObjects';
import { HTTP_DELAY_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { isValid } from 'utils/Common';

export type DelayFaultProps = {
  delayed: boolean;
  delay: Delay;
  isValid: boolean;
  onDelay: (delayed: boolean, delay: Delay) => void;
};

const fixedDelayedMsg = 'Add a fixed delay before forwarding the request. Format: 1h/1m/1s/1ms. MUST be >=1ms.';

class DelayFault extends React.Component<DelayFaultProps> {
  render() {
    return (
      <>
        <FormGroup label="Add HTTP Delay" fieldId="delaySwitch">
          <Switch
            id="delaySwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.props.delayed}
            onChange={() => this.props.onDelay(!this.props.delayed, this.props.delay)}
          />
          <span>{wizardTooltip(HTTP_DELAY_TOOLTIP)}</span>
        </FormGroup>
        {this.props.delayed && (
          <FormGroup
            label="Delay Percentage"
            fieldId="delay-percentage"
            helperText="Percentage of requests on which the delay will be injected."
          >
            <TextInput
              value={this.props.delay.percentage?.value}
              type="text"
              id="delay-percentage"
              name="delay-percentage"
              onChange={value => {
                let newValue = Number(value || 0);
                newValue = Number.isNaN(newValue) ? 0 : newValue;
                newValue = newValue < 0 ? 0 : newValue > 100 ? 100 : newValue;
                this.props.onDelay(this.props.delayed, {
                  percentage: {
                    value: newValue
                  },
                  fixedDelay: this.props.delay.fixedDelay
                });
              }}
            />
          </FormGroup>
        )}
        {this.props.delayed && (
          <FormGroup
            label="Fixed Delay"
            fieldId="fixed-delay"
            helperText={fixedDelayedMsg}
            helperTextInvalid={fixedDelayedMsg}
            validated={isValid(this.props.isValid)}
          >
            <TextInput
              value={this.props.delay.fixedDelay}
              id="fixed-delay"
              name="fixed-delay"
              validated={isValid(this.props.isValid)}
              onChange={value =>
                this.props.onDelay(this.props.delayed, {
                  percentage: this.props.delay.percentage,
                  fixedDelay: value
                })
              }
            />
          </FormGroup>
        )}
      </>
    );
  }
}

export default DelayFault;

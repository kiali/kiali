import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem, Switch, TextInput } from '@patternfly/react-core';
import { HTTP_TIMEOUT_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { t } from 'utils/I18nUtils';

export type RouteTimeoutProps = {
  isTimeout: boolean;
  timeout: string;
  isValid: boolean;
  onTimeout: (isTimeout: boolean, timeout: string) => void;
};

const timeoutMsg = t('Timeout for HTTP requests. Format: 1h/1m/1s/1ms. MUST be >=1ms.');

export class RouteTimeout extends React.Component<RouteTimeoutProps> {
  render() {
    return (
      <>
        <FormGroup label={t('Add HTTP Timeout')} fieldId="timeoutSwitch">
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
          <FormGroup label={t('Timeout')} fieldId="timeout-value">
            <TextInput
              value={this.props.timeout}
              type="text"
              id="timeout-value"
              name="timeout-value"
              onChange={(_event, value) => this.props.onTimeout(this.props.isTimeout, value)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t(timeoutMsg)}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}
      </>
    );
  }
}

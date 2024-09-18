import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem, Switch, TextInput } from '@patternfly/react-core';
import { HTTPRetry } from '../../../types/IstioObjects';
import { HTTP_RETRY_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { isValid } from 'utils/Common';
import { t } from 'utils/I18nUtils';

export type RouteRetryProps = {
  isRetry: boolean;
  retries: HTTPRetry;
  isValidRetry: boolean;
  onRetry: (isRetry: boolean, retries: HTTPRetry) => void;
};

export class RouteRetry extends React.Component<RouteRetryProps> {
  render() {
    const tryTimeoutMsg = t('Timeout per retry attempt for a given request. Format: 1h/1m/1s/1ms. MUST be >=1ms.');
    return (
      <>
        <FormGroup label={t('Add HTTP Retry')} fieldId="retrySwitch">
          <Switch
            id="retrySwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.props.isRetry}
            onChange={() => this.props.onRetry(!this.props.isRetry, this.props.retries)}
          />
          <span>{wizardTooltip(HTTP_RETRY_TOOLTIP)}</span>
        </FormGroup>
        {this.props.isRetry && (
          <>
            <FormGroup label={t('Attempts')} fieldId="attempts">
              <TextInput
                value={this.props.retries.attempts}
                type="text"
                id="attempts"
                name="attempts"
                onChange={(_event, value) => {
                  let newValue = Number(value || 0);
                  newValue = Number.isNaN(newValue) ? 0 : newValue;
                  this.props.onRetry(this.props.isRetry, {
                    attempts: newValue,
                    perTryTimeout: this.props.retries.perTryTimeout,
                    retryOn: this.props.retries.retryOn
                  });
                }}
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{t('Number of retries for a given request.')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup label={t('Per Try Timeout')} fieldId="pre-try-timeout">
              <TextInput
                value={this.props.retries.perTryTimeout}
                id="pre-try-timeout"
                name="pre-try-timeout"
                validated={isValid(this.props.isValidRetry)}
                onChange={(_event, value) =>
                  this.props.onRetry(this.props.isRetry, {
                    attempts: this.props.retries.attempts,
                    perTryTimeout: value,
                    retryOn: this.props.retries.retryOn
                  })
                }
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{isValid(this.props.isValidRetry) ? tryTimeoutMsg : tryTimeoutMsg}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </>
        )}
      </>
    );
  }
}

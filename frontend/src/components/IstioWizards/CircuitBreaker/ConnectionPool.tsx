import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem, Switch, TextInput } from '@patternfly/react-core';
import { ConnectionPoolSettings } from '../../../types/IstioObjects';
import { CONNECTION_POOL_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { t } from 'utils/I18nUtils';

type Props = {
  isConnectionPool: boolean;
  connectionPool: ConnectionPoolSettings;
  onConnectionPool: (isConnectionPool: boolean, connectionPool: ConnectionPoolSettings) => void;
};

export class ConnectionPool extends React.Component<Props> {
  render() {
    return (
      <>
        <FormGroup label={t('Add Connection Pool')} fieldId="cpSwitch">
          <Switch
            id="cpSwitch"
            label={' '}
            
            isChecked={this.props.isConnectionPool}
            onChange={() => this.props.onConnectionPool(!this.props.isConnectionPool, this.props.connectionPool)}
          />
          <span>{wizardTooltip(CONNECTION_POOL_TOOLTIP)}</span>
        </FormGroup>
        {this.props.isConnectionPool && (
          <FormGroup label={t('Max Connections')} fieldId="maxConnections">
            <TextInput
              value={this.props.connectionPool.tcp?.maxConnections}
              id="maxConnections"
              name="maxConnections"
              onChange={(_event, value) => {
                let newValue = Number(value || 0);
                newValue = Number.isNaN(newValue) ? 0 : newValue;
                const cp = this.props.connectionPool;
                if (!cp.tcp) {
                  cp.tcp = {};
                }
                cp.tcp.maxConnections = newValue;
                this.props.onConnectionPool(this.props.isConnectionPool, cp);
              }}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Maximum number of HTTP1 /TCP connections to a destination host.')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}
        {this.props.isConnectionPool && (
          <FormGroup label={t('HTTP1 Max Pending Requests')} fieldId="http1MaxPendingRequests">
            <TextInput
              value={this.props.connectionPool.http?.http1MaxPendingRequests}
              id="http1MaxPendingRequests"
              name="http1MaxPendingRequests"
              onChange={(_event, value) => {
                let newValue = Number(value || 0);
                newValue = Number.isNaN(newValue) ? 0 : newValue;
                const cp = this.props.connectionPool;
                if (!cp.http) {
                  cp.http = {};
                }
                cp.http.http1MaxPendingRequests = newValue;
                this.props.onConnectionPool(this.props.isConnectionPool, cp);
              }}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Maximum number of pending HTTP requests to a destination.')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}
      </>
    );
  }
}

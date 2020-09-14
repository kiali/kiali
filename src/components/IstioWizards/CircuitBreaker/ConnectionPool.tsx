import * as React from 'react';
import { FormGroup, Switch, TextInput } from '@patternfly/react-core';
import { ConnectionPoolSettings } from '../../../types/IstioObjects';

type Props = {
  isConnectionPool: boolean;
  connectionPool: ConnectionPoolSettings;
  onConnectionPool: (isConnectionPool: boolean, connectionPool: ConnectionPoolSettings) => void;
};

class ConnectionPool extends React.Component<Props> {
  render() {
    return (
      <>
        <FormGroup label="Add Connection Pool" fieldId="cpSwitch">
          <Switch
            id="cpSwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.props.isConnectionPool}
            onChange={() => this.props.onConnectionPool(!this.props.isConnectionPool, this.props.connectionPool)}
          />
        </FormGroup>
        {this.props.isConnectionPool && (
          <FormGroup
            label="Max Connections"
            fieldId="maxConnections"
            helperText="Maximum number of HTTP1 /TCP connections to a destination host"
          >
            <TextInput
              value={this.props.connectionPool.tcp?.maxConnections}
              id="maxConnections"
              name="maxConnections"
              onChange={value => {
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
          </FormGroup>
        )}
        {this.props.isConnectionPool && (
          <FormGroup
            label="HTTP1 Max Pending Requests"
            fieldId="http1MaxPendingRequests"
            helperText="Maximum number of pending HTTP requests to a destination."
          >
            <TextInput
              value={this.props.connectionPool.http?.http1MaxPendingRequests}
              id="http1MaxPendingRequests"
              name="http1MaxPendingRequests"
              onChange={value => {
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
          </FormGroup>
        )}
      </>
    );
  }
}

export default ConnectionPool;

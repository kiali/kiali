import * as React from 'react';
import { ConnectionPoolSettings, OutlierDetection as OutlierDetectionProps } from '../../types/IstioObjects';
import { isValidConnectionPool, isValidOutlierDetection } from '../../utils/IstioConfigUtils';
import { Form } from '@patternfly/react-core';
import { ConnectionPool } from './CircuitBreaker/ConnectionPool';
import { OutlierDetection } from './CircuitBreaker/OutlierDetection';

type Props = {
  hasConnectionPool: boolean;
  connectionPool: ConnectionPoolSettings;
  hasOutlierDetection: boolean;
  outlierDetection: OutlierDetectionProps;
  onCircuitBreakerChange: (circuitBreaker: CircuitBreakerState) => void;
};
export type CircuitBreakerState = {
  addConnectionPool: boolean;
  connectionPool: ConnectionPoolSettings;
  isValidConnectionPool: boolean;
  addOutlierDetection: boolean;
  outlierDetection: OutlierDetectionProps;
  isValidOutlierDetection: boolean;
};

export class CircuitBreaker extends React.Component<Props, CircuitBreakerState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addConnectionPool: this.props.hasConnectionPool,
      connectionPool: this.props.connectionPool,
      isValidConnectionPool: this.props.hasConnectionPool ? isValidConnectionPool(this.props.connectionPool) : true,
      addOutlierDetection: this.props.hasOutlierDetection,
      outlierDetection: this.props.outlierDetection,
      isValidOutlierDetection: this.props.hasOutlierDetection
        ? isValidOutlierDetection(this.props.outlierDetection)
        : true
    };
  }

  resetState = () => {
    this.setState({
      addConnectionPool: this.props.hasConnectionPool,
      connectionPool: this.props.connectionPool,
      isValidConnectionPool: this.props.hasConnectionPool ? isValidConnectionPool(this.props.connectionPool) : true,
      addOutlierDetection: this.props.hasOutlierDetection,
      outlierDetection: this.props.outlierDetection,
      isValidOutlierDetection: this.props.hasOutlierDetection
        ? isValidOutlierDetection(this.props.outlierDetection)
        : true
    });
  };

  componentDidMount(): void {
    this.resetState();
  }

  render() {
    return (
      <Form
        isHorizontal={true}
        style={{
          paddingTop: 10,
          paddingBottom: 10
        }}
      >
        <ConnectionPool
          isConnectionPool={this.state.addConnectionPool}
          connectionPool={this.state.connectionPool}
          onConnectionPool={(isConnectionPool, connectionPool) => {
            this.setState(
              prevState => {
                if (connectionPool.tcp) {
                  prevState.connectionPool.tcp = connectionPool.tcp;
                }
                if (connectionPool.http) {
                  prevState.connectionPool.http = connectionPool.http;
                }
                return {
                  addConnectionPool: isConnectionPool,
                  connectionPool: prevState.connectionPool,
                  isValidConnectionPool: isConnectionPool ? isValidConnectionPool(prevState.connectionPool) : true
                };
              },
              () => this.props.onCircuitBreakerChange(this.state)
            );
          }}
        />
        <OutlierDetection
          isOutlierDetection={this.state.addOutlierDetection}
          outlierDetection={this.state.outlierDetection}
          onOutlierDetection={(isOutlierDetection, outlierDetection) => {
            this.setState(
              prevState => {
                if (outlierDetection.consecutiveErrors) {
                  prevState.outlierDetection.consecutiveErrors = outlierDetection.consecutiveErrors;
                }
                return {
                  addOutlierDetection: isOutlierDetection,
                  isValidOutlierDetection: isOutlierDetection
                    ? isValidOutlierDetection(prevState.outlierDetection)
                    : true
                };
              },
              () => this.props.onCircuitBreakerChange(this.state)
            );
          }}
        />
      </Form>
    );
  }
}

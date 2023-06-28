import * as React from 'react';
import { HTTPRetry } from '../../types/IstioObjects';
import { Form } from '@patternfly/react-core';
import { isValidDuration } from '../../utils/IstioConfigUtils';
import { WorkloadWeight } from './TrafficShifting';
import { RouteTimeout } from './RequestTimeouts/RouteTimeout';
import { RouteRetry } from './RequestTimeouts/RouteRetry';

type Props = {
  initTimeoutRetry: TimeoutRetryRoute;
  onChange: (valid: boolean, timeoutRetryRoute: TimeoutRetryRoute) => void;
};

// Used in the scenario of a single route
export type TimeoutRetryRoute = {
  workloads: WorkloadWeight[];
  isTimeout: boolean;
  timeout: string;
  isValidTimeout: boolean;
  isRetry: boolean;
  retries: HTTPRetry;
  isValidRetry: boolean;
};

type State = {
  timeoutRetryRoute: TimeoutRetryRoute;
};

export class RequestTimeouts extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      timeoutRetryRoute: {
        workloads: this.props.initTimeoutRetry.workloads,
        isTimeout: this.props.initTimeoutRetry.isTimeout,
        timeout: this.props.initTimeoutRetry.timeout,
        isValidTimeout: isValidDuration(this.props.initTimeoutRetry.timeout),
        isRetry: this.props.initTimeoutRetry.isRetry,
        retries: this.props.initTimeoutRetry.retries,
        isValidRetry: this.props.initTimeoutRetry.retries.perTryTimeout
          ? isValidDuration(this.props.initTimeoutRetry.retries.perTryTimeout)
          : false
      }
    };
  }

  resetState = () => {
    this.setState(
      {
        timeoutRetryRoute: {
          workloads: this.props.initTimeoutRetry.workloads,
          isTimeout: this.props.initTimeoutRetry.isTimeout,
          timeout: this.props.initTimeoutRetry.timeout,
          isValidTimeout: this.props.initTimeoutRetry.isTimeout
            ? isValidDuration(this.props.initTimeoutRetry.timeout)
            : true,
          isRetry: this.props.initTimeoutRetry.isRetry,
          retries: this.props.initTimeoutRetry.retries,
          isValidRetry: this.props.initTimeoutRetry.isRetry
            ? this.props.initTimeoutRetry.retries.perTryTimeout
              ? isValidDuration(this.props.initTimeoutRetry.retries.perTryTimeout)
              : false
            : true
        }
      },
      () =>
        this.props.onChange(
          this.state.timeoutRetryRoute.isValidTimeout && this.state.timeoutRetryRoute.isValidRetry,
          this.state.timeoutRetryRoute
        )
    );
  };

  componentDidMount(): void {
    this.resetState();
  }

  updateTimeout = (isTimeout: boolean, timeout: string) => {
    this.setState(
      prevState => {
        return {
          timeoutRetryRoute: {
            workloads: prevState.timeoutRetryRoute.workloads,
            isTimeout: isTimeout,
            timeout: timeout,
            isValidTimeout: isTimeout ? isValidDuration(timeout) : true,
            isRetry: prevState.timeoutRetryRoute.isRetry,
            retries: prevState.timeoutRetryRoute.retries,
            isValidRetry: prevState.timeoutRetryRoute.isValidRetry
          }
        };
      },
      () =>
        this.props.onChange(
          this.state.timeoutRetryRoute.isValidTimeout && this.state.timeoutRetryRoute.isValidRetry,
          this.state.timeoutRetryRoute
        )
    );
  };

  updateRetry = (isRetry: boolean, retries: HTTPRetry) => {
    this.setState(
      prevState => {
        return {
          timeoutRetryRoute: {
            workloads: prevState.timeoutRetryRoute.workloads,
            isTimeout: prevState.timeoutRetryRoute.isTimeout,
            timeout: prevState.timeoutRetryRoute.timeout,
            isValidTimeout: prevState.timeoutRetryRoute.isValidTimeout,
            isRetry: isRetry,
            retries: retries,
            isValidRetry: isRetry ? (retries.perTryTimeout ? isValidDuration(retries.perTryTimeout) : false) : true
          }
        };
      },
      () => {
        this.props.onChange(
          this.state.timeoutRetryRoute.isValidTimeout && this.state.timeoutRetryRoute.isValidRetry,
          this.state.timeoutRetryRoute
        );
      }
    );
  };

  render() {
    return (
      <>
        <Form
          isHorizontal={true}
          style={{
            paddingTop: 10,
            paddingBottom: 10
          }}
        >
          <RouteTimeout
            isTimeout={this.state.timeoutRetryRoute.isTimeout}
            timeout={this.state.timeoutRetryRoute.timeout}
            isValid={this.state.timeoutRetryRoute.isValidTimeout}
            onTimeout={(isTimeout, timeout) => this.updateTimeout(isTimeout, timeout)}
          />
          <RouteRetry
            isRetry={this.state.timeoutRetryRoute.isRetry}
            retries={this.state.timeoutRetryRoute.retries}
            isValidRetry={this.state.timeoutRetryRoute.isValidRetry}
            onRetry={(isRetry, retries) => this.updateRetry(isRetry, retries)}
          />
        </Form>
      </>
    );
  }
}

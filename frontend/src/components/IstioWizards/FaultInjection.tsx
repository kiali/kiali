import * as React from 'react';
import { DelayFault } from './FaultInjection/DelayFault';
import { AbortFault } from './FaultInjection/AbortFault';
import { Abort, Delay } from '../../types/IstioObjects';
import { Form } from '@patternfly/react-core';
import { isValidAbortStatusCode, isValidDuration } from '../../utils/IstioConfigUtils';
import { WorkloadWeight } from './TrafficShifting';

type Props = {
  initFaultInjectionRoute: FaultInjectionRoute;
  onChange: (valid: boolean, faultInjectionRoute: FaultInjectionRoute) => void;
};

// Used in the scenario of a single route
export type FaultInjectionRoute = {
  workloads: WorkloadWeight[];
  delayed: boolean;
  delay: Delay;
  isValidDelay: boolean;
  aborted: boolean;
  abort: Abort;
  isValidAbort: boolean;
};

type State = {
  faultInjectionRoute: FaultInjectionRoute;
};

export class FaultInjection extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      faultInjectionRoute: {
        workloads: this.props.initFaultInjectionRoute.workloads,
        delayed: this.props.initFaultInjectionRoute.delayed,
        delay: this.props.initFaultInjectionRoute.delay,
        aborted: this.props.initFaultInjectionRoute.aborted,
        abort: this.props.initFaultInjectionRoute.abort,
        isValidDelay: this.props.initFaultInjectionRoute.delayed
          ? isValidDuration(this.props.initFaultInjectionRoute.delay.fixedDelay)
          : true,
        isValidAbort: this.props.initFaultInjectionRoute.aborted
          ? isValidAbortStatusCode(this.props.initFaultInjectionRoute.abort.httpStatus)
          : true
      }
    };
  }

  resetState = () => {
    this.setState(
      {
        faultInjectionRoute: {
          workloads: this.props.initFaultInjectionRoute.workloads,
          delayed: this.props.initFaultInjectionRoute.delayed,
          delay: this.props.initFaultInjectionRoute.delay,
          aborted: this.props.initFaultInjectionRoute.aborted,
          abort: this.props.initFaultInjectionRoute.abort,
          isValidDelay: this.props.initFaultInjectionRoute.delayed
            ? isValidDuration(this.props.initFaultInjectionRoute.delay.fixedDelay)
            : true,
          isValidAbort: this.props.initFaultInjectionRoute.aborted
            ? isValidAbortStatusCode(this.props.initFaultInjectionRoute.abort.httpStatus)
            : true
        }
      },
      () =>
        this.props.onChange(
          this.state.faultInjectionRoute.isValidDelay && this.state.faultInjectionRoute.isValidAbort,
          this.state.faultInjectionRoute
        )
    );
  };

  componentDidMount(): void {
    this.resetState();
  }

  updateDelay = (delayed: boolean, delay: Delay) => {
    this.setState(
      prevState => {
        return {
          faultInjectionRoute: {
            workloads: prevState.faultInjectionRoute.workloads,
            delayed: delayed,
            delay: delay,
            isValidDelay: delayed ? isValidDuration(delay.fixedDelay) : true,
            aborted: prevState.faultInjectionRoute.aborted,
            abort: prevState.faultInjectionRoute.abort,
            isValidAbort: prevState.faultInjectionRoute.isValidAbort
          }
        };
      },
      () =>
        this.props.onChange(
          this.state.faultInjectionRoute.isValidDelay && this.state.faultInjectionRoute.isValidAbort,
          this.state.faultInjectionRoute
        )
    );
  };

  updateAbort = (aborted: boolean, abort: Abort) => {
    this.setState(
      prevState => {
        return {
          faultInjectionRoute: {
            workloads: prevState.faultInjectionRoute.workloads,
            delayed: prevState.faultInjectionRoute.delayed,
            delay: prevState.faultInjectionRoute.delay,
            isValidDelay: prevState.faultInjectionRoute.isValidDelay,
            aborted: aborted,
            abort: abort,
            isValidAbort: aborted ? isValidAbortStatusCode(abort.httpStatus) : true
          }
        };
      },
      () =>
        this.props.onChange(
          this.state.faultInjectionRoute.isValidDelay && this.state.faultInjectionRoute.isValidAbort,
          this.state.faultInjectionRoute
        )
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
          <DelayFault
            delayed={this.state.faultInjectionRoute.delayed}
            delay={this.state.faultInjectionRoute.delay}
            isValid={this.state.faultInjectionRoute.isValidDelay}
            onDelay={(delayed, delay) => this.updateDelay(delayed, delay)}
          />
          <AbortFault
            aborted={this.state.faultInjectionRoute.aborted}
            abort={this.state.faultInjectionRoute.abort}
            isValid={this.state.faultInjectionRoute.isValidAbort}
            onAbort={(aborted, abort) => this.updateAbort(aborted, abort)}
          />
        </Form>
      </>
    );
  }
}

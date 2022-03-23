import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

type ErrorHandlerFunction = (error: Error, componentStack: string) => void;

type SwitchErrorBoundaryProps = {
  fallBackComponent: any;
  onError?: ErrorHandlerFunction;
};

type SwitchErrorBoundaryState = {
  hasError: boolean;
};

export default class SwitchErrorBoundary extends React.Component<SwitchErrorBoundaryProps, SwitchErrorBoundaryState> {
  private show: boolean;

  constructor(props: SwitchErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
    this.show = false;
  }

  componentDidCatch(error: any, info: any) {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
    this.setState({ hasError: true });
  }

  componentDidUpdate() {
    if (this.state.hasError) {
      if (this.show) {
        this.setState({ hasError: false });
      }
      this.show = !this.show;
    }
  }

  render() {
    return (
      <Switch>
        {this.state.hasError && <Route component={this.props.fallBackComponent} />}
        {this.props.children}
      </Switch>
    );
  }
}

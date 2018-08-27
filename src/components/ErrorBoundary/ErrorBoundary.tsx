import * as React from 'react';

type ErrorHandlerFunction = (error: Error, componentStack: string) => void;

type ErrorBoundaryProps = {
  fallBackComponent: any;
  onError?: ErrorHandlerFunction;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error: Error, info: any) {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
    this.setState({ hasError: true });
  }

  cleanError = () => {
    this.setState((prevState: ErrorBoundaryState) => {
      if (prevState.hasError) {
        return { hasError: false };
      }
      return null;
    });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallBackComponent;
    }
    return this.props.children;
  }
}

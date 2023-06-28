import * as React from 'react';
import { useRefreshInterval } from '../../hooks/refresh';

// TODO: This is a transition component. Please, avoid using this HOC/function.
//  Prefer usage of the useRefreshInterval hook for function components, or the RefreshNotifier component for class components.
export function connectRefresh<P extends { lastRefreshAt: number }>(Component: React.ComponentType<P>) {
  return React.forwardRef((props: Omit<P, 'lastRefreshAt'>, ref) => {
    const refreshing = useRefreshInterval();

    return <Component {...(props as P)} ref={ref} lastRefreshAt={refreshing.lastRefreshAt} />;
  });
}

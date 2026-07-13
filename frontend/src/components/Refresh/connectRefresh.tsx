import * as React from 'react';
import { useRefreshInterval } from '../../hooks/refresh';

// TODO: This is a transition component. Please, avoid using this HOC/function.
//  Prefer usage of the useRefreshInterval hook for function components, or the RefreshNotifier component for class components.
export function connectRefresh<C extends React.ComponentType<any>>(
  Component: C
): React.ComponentType<Omit<React.ComponentProps<C>, 'lastRefreshAt'>> {
  return (React.forwardRef<unknown, Omit<React.ComponentProps<C>, 'lastRefreshAt'>>((props, ref) => {
    const refreshing = useRefreshInterval();
    const WrappedComponent = Component as React.ComponentType<any>;

    return <WrappedComponent {...props} ref={ref} lastRefreshAt={refreshing.lastRefreshAt} />;
  }) as unknown) as React.ComponentType<Omit<React.ComponentProps<C>, 'lastRefreshAt'>>;
}

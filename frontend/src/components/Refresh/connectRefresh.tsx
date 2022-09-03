import * as React from "react";
import useRefreshInterval from "../../hooks/refresh";

// TODO: This is a transition component. Please, avoid using this HOC/function.
//  Prefer usage of the useRefreshInterval hook for function components, or the RefreshNotifier component for class components.
export default function connectRefresh<P extends { lastRefreshAt: number }>(Component: React.ComponentType<P>) {
  return function (props: Omit<P, 'lastRefreshAt'>) {
    const refreshing = useRefreshInterval();

    console.log('Rendering connectedRefresh component:', Component, refreshing.lastRefreshAt);

    return (
      <Component {...props as P} lastRefreshAt={refreshing.lastRefreshAt} />
    );
  };
}

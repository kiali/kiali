import * as React from 'react';
import { TimeInMilliseconds } from '../../types/Common';
import { useRefreshInterval } from '../../hooks/refresh';

interface RefreshProps {
  onTick: (timestamp: TimeInMilliseconds) => void;
}

// RefreshNotifier won't render any visual element. Its work is limited to calling
// the onTick function passed in the props. The onTick function will be called
// each time a global refresh event is emitted (i.e. when the user specified
// refresh interval has elapsed). Class components wanting to watch for these
// global refresh events should use this <RefreshNotifier onTick={yourCallBack}> component.
// For function components, use the useRefreshInterval() hook.
export const RefreshNotifier = ({ onTick }: RefreshProps): null => {
  const { previousRefreshAt, lastRefreshAt } = useRefreshInterval();

  React.useEffect(() => {
    if (previousRefreshAt !== lastRefreshAt) {
      // We only want to notify when a refresh happens. At mount, previousRefreshAt == lastRefreshAt.
      // So, we notify only when both values are different.
      onTick(lastRefreshAt);

      // NOTE: This won't handle well the case when props.onTick changes. If that happens,
      // this will immediately call props.onTick, even if a refresh hasn't been fired.
    }
  }, [onTick, previousRefreshAt, lastRefreshAt]);

  return null;
};

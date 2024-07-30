import * as React from 'react';
import { useSelector } from 'react-redux';
import { KialiAppState } from '../store/Store';
import { IntervalInMilliseconds, TimeInMilliseconds } from '../types/Common';

let numSubscribers = 0;
let intervalId: number | null = null;

interface RefreshInterval {
  lastRefreshAt: number;
  previousRefreshAt: number;
  refreshInterval: number;
}

const doTick = (time?: TimeInMilliseconds): void => {
  const refreshTick = new CustomEvent('refreshTick', { detail: time ?? Date.now() });
  document.dispatchEvent(refreshTick);
};

export const triggerRefresh = (time?: TimeInMilliseconds): void => {
  doTick(time);
};

export const useRefreshInterval = (): RefreshInterval => {
  const refreshInterval = useSelector<KialiAppState, IntervalInMilliseconds>(
    state => state.userSettings.refreshInterval
  );

  const [lastRefreshAt, setLastRefreshAt] = React.useState<TimeInMilliseconds>(Date.now());
  const [previousRefreshAt, setPreviousRefreshAt] = React.useState<TimeInMilliseconds>(lastRefreshAt);

  React.useEffect(() => {
    const handleTick = (e: CustomEventInit<TimeInMilliseconds>): void => {
      setPreviousRefreshAt(lastRefreshAt);
      setLastRefreshAt(e.detail!);
    };

    // Subscribe
    document.addEventListener('refreshTick', handleTick);
    numSubscribers++;

    return () => {
      // Unsubscribe;
      document.removeEventListener('refreshTick', handleTick);
      numSubscribers--;
    };
  }, [lastRefreshAt]);

  React.useEffect(() => {
    if (intervalId !== null) {
      // When mounting, reset the timer.
      // Also, if refreshInterval changed, set a new timer.
      window.clearInterval(intervalId);
      intervalId = null;
    }

    if (numSubscribers !== 0 && refreshInterval !== 0) {
      intervalId = window.setInterval(triggerRefresh, refreshInterval);
    }

    return () => {
      if (intervalId !== null && numSubscribers === 0) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [refreshInterval]);

  return { lastRefreshAt, previousRefreshAt, refreshInterval };
};

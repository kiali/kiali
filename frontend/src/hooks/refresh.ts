import { useSelector } from "react-redux";
import { KialiAppState } from "../store/Store";
import { IntervalInMilliseconds, TimeInMilliseconds } from "../types/Common";
import { useEffect, useState } from "react";

let numSubscribers = 0;
let intervalId: null | number = null;

function doTick(time?: TimeInMilliseconds) {
  const refreshTick = new CustomEvent('refreshTick', {detail: time ?? Date.now()});
  document.dispatchEvent(refreshTick);
}

export function triggerRefresh(time?: TimeInMilliseconds) {
  doTick(time);
}

export default function useRefreshInterval() {
  const refreshInterval = useSelector<KialiAppState, IntervalInMilliseconds>((state) => state.userSettings.refreshInterval);
  const [lastRefreshAt, setLastRefreshAt] = useState<TimeInMilliseconds>(Date.now());
  const [previousRefreshAt, setPreviousRefreshAt] = useState<TimeInMilliseconds>(lastRefreshAt);

  useEffect(() => {
    function handleTick(e: CustomEventInit<TimeInMilliseconds>) {
      setPreviousRefreshAt(lastRefreshAt);
      setLastRefreshAt(e.detail!);
    }

    // Subscribe
    document.addEventListener('refreshTick', handleTick);
    numSubscribers++;

    return function () {
      // Unsubscribe;
      document.removeEventListener('refreshTick', handleTick);
      numSubscribers--;
    };
  }, [lastRefreshAt]);

  useEffect(() => {
    if (intervalId !== null) {
      // When mounting, reset the timer.
      // Also, if refreshInterval changed, set a new timer.
      window.clearInterval(intervalId);
      intervalId = null;
    }

    if (numSubscribers !== 0 && refreshInterval !== 0) {
      intervalId = window.setInterval(triggerRefresh, refreshInterval);
    }

    return function () {
      if (intervalId !== null && numSubscribers === 0) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }
  }, [refreshInterval]);

  return { lastRefreshAt, previousRefreshAt, refreshInterval };
}

import * as React from 'react';
import { useSelector } from 'react-redux';
import { RefreshIntervalManual } from 'config/Config';
import { HistoryManager } from 'app/History';
import { KialiAppState } from '../store/Store';
import { IntervalInMilliseconds, TimeInMilliseconds } from '../types/Common';

// Global state shared across all hook instances to coordinate a single refresh timer.
// This ensures only one interval runs regardless of how many components use the hook.
let numSubscribers = 0;
let intervalId: number | null = null;

interface RefreshInterval {
  lastRefreshAt: number;
  previousRefreshAt: number;
  refreshInterval: number;
}

// Dispatches a custom DOM event that all subscribers listen for
const doTick = (time?: TimeInMilliseconds): void => {
  const refreshTick = new CustomEvent('refreshTick', { detail: time ?? Date.now() });
  document.dispatchEvent(refreshTick);
};

/**
 * Manually triggers a refresh event that all `useRefreshInterval` subscribers will receive.
 *
 * Use this to programmatically trigger a refresh from outside of React components,
 * such as from the Refresh button component.
 *
 * @param time - Optional timestamp to use for the refresh (defaults to Date.now())
 */
export const triggerRefresh = (time?: TimeInMilliseconds): void => {
  doTick(time);
};

/**
 * A hook that provides refresh timing state and coordinates automatic refresh across components.
 *
 * ## Architecture
 *
 * This hook implements a pub/sub pattern using DOM CustomEvents:
 * - A single global `setInterval` timer dispatches "refreshTick" events
 * - All components using this hook subscribe to these events
 * - The timer only runs when there's at least one subscriber and the interval is > 1ms
 *
 * This design ensures:
 * - All components refresh simultaneously (consistent UI updates)
 * - Only one timer runs regardless of how many components use the hook
 * - Timer is automatically cleaned up when all subscribers unmount
 *
 * ## Return values
 *
 * @returns {Object} Refresh state
 * @returns {number} lastRefreshAt - Timestamp of the most recent refresh
 * @returns {number} previousRefreshAt - Timestamp of the refresh before the most recent one
 * @returns {number} refreshInterval - Current refresh interval in milliseconds (from Redux)
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const { lastRefreshAt, refreshInterval } = useRefreshInterval();
 *
 *   React.useEffect(() => {
 *     fetchData();
 *   }, [lastRefreshAt]);
 *
 *   return <div>Refreshing every {refreshInterval}ms</div>;
 * };
 * ```
 */
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

    if (numSubscribers !== 0 && refreshInterval > 1) {
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

/**
 * A hook to manage the "loaded" state for pages that need to handle manual refresh mode.
 *
 * ## Why this hook exists
 *
 * When the user sets the refresh interval to "Manual", the page should NOT automatically
 * load data. Instead, it shows a "Manual refresh required" empty state until the user
 * explicitly clicks the Refresh button.
 *
 * ## The dual-source problem
 *
 * Detecting manual refresh mode is tricky because no single source is reliable in all cases:
 *
 * 1. **Redux state (`refreshInterval`):**
 *    - Correct for client-side navigation (persists across pages)
 *    - BUT stale on F5/page reload (returns default value before hydration)
 *
 * 2. **URL query params (`HistoryManager.getRefresh()`):**
 *    - Correct on F5/page reload (URL params are immediately available)
 *    - BUT empty on client-side navigation (React Router doesn't carry search params across navigations)
 *
 * ## Solution
 *
 * This hook checks BOTH sources on initial render to determine if we're in manual mode.
 * It then tracks:
 * - When `lastRefreshAt` changes (user clicked Refresh)
 * - When `refreshInterval` changes from manual to automatic
 *
 * Either event sets `loaded` to true, allowing the page to render its content.
 *
 * @returns {boolean} `loaded` - true if the page should render content, false if it should show manual refresh empty state
 *
 * @example
 * ```tsx
 * const MyPage: React.FC = () => {
 *   const loaded = useManualRefreshState();
 *
 *   if (!loaded) {
 *     return <ManualRefreshEmptyState />;
 *   }
 *
 *   return <PageContent />;
 * };
 * ```
 */
export const useManualRefreshState = (): boolean => {
  const { lastRefreshAt, refreshInterval } = useRefreshInterval();

  // Initial state: loaded=true unless we detect manual mode from either Redux OR URL
  const [loaded, setLoaded] = React.useState(
    () => refreshInterval !== RefreshIntervalManual && HistoryManager.getRefresh() !== RefreshIntervalManual
  );

  // Track the initial lastRefreshAt to detect when a refresh actually happens
  const initialRefreshAt = React.useRef(lastRefreshAt);

  // Track previous refreshInterval to detect transitions out of manual mode
  const prevRefreshInterval = React.useRef(refreshInterval);

  // Effect 1: Detect when user triggers a refresh while in manual mode
  React.useEffect(() => {
    if (!loaded && lastRefreshAt !== initialRefreshAt.current) {
      setLoaded(true);
    }
  }, [lastRefreshAt, loaded]);

  // Effect 2: Detect when refreshInterval changes from manual to automatic
  React.useEffect(() => {
    const prev = prevRefreshInterval.current;
    prevRefreshInterval.current = refreshInterval;

    if (!loaded && prev === RefreshIntervalManual && refreshInterval !== RefreshIntervalManual) {
      setLoaded(true);
    }
  }, [refreshInterval, loaded]);

  return loaded;
};

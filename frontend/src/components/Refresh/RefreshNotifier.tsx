import { useEffect } from "react";
import { TimeInMilliseconds } from "../../types/Common";
import useRefreshInterval from "../../hooks/refresh";

interface Props {
  onTick: (timestamp: TimeInMilliseconds) => void;
}

export default function RefreshNotifier({ onTick }: Props) {
  const refreshing = useRefreshInterval();

  useEffect(() => {
    if (refreshing.previousRefreshAt !== refreshing.lastRefreshAt) {
      // We only want to notify when a refresh happens. At mount, previousRefreshAt == lastRefreshAt.
      // So, we notify only when both values are different.
      onTick(refreshing.lastRefreshAt);

      // NOTE: This won't handle well the case when props.onTick changes. If that happens,
      // this will immediately call props.onTick, even if a refresh hasn't been fired.
    }
  }, [onTick, refreshing.previousRefreshAt, refreshing.lastRefreshAt]);

  return null;
}

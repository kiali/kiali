import { TimeRange } from 'types/Common';
import { HistoryManager, URLParam } from 'app/History';

export const retrieveTimeRange = (): TimeRange => {
  const urlBounds = HistoryManager.getTimeBounds();
  const urlRangeDuration = HistoryManager.getRangeDuration();

  return {
    from: urlBounds?.from,
    to: urlBounds?.to,
    rangeDuration: urlRangeDuration
  };
};

export const storeTimeRange = (range: TimeRange): void => {
  if (range.from) {
    HistoryManager.setParam(URLParam.FROM, String(range.from));

    if (range.to) {
      HistoryManager.setParam(URLParam.TO, String(range.to));
    } else {
      HistoryManager.deleteParam(URLParam.TO);
    }

    HistoryManager.deleteParam(URLParam.RANGE_DURATION);
  } else if (range.rangeDuration) {
    HistoryManager.setParam(URLParam.RANGE_DURATION, String(range.rangeDuration));

    HistoryManager.deleteParam(URLParam.FROM);
    HistoryManager.deleteParam(URLParam.TO);
  }
};

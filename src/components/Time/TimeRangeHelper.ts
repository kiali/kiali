import { DurationInSeconds, BoundsInMilliseconds, TimeRange, guardTimeRange } from 'types/Common';
import { HistoryManager, URLParam } from 'app/History';

export const retrieveDuration = (): DurationInSeconds | undefined => {
  const urlDuration = HistoryManager.getDuration();
  if (urlDuration !== undefined) {
    sessionStorage.setItem(URLParam.DURATION, String(urlDuration));
    return urlDuration;
  }
  const storageDuration = sessionStorage.getItem(URLParam.DURATION);
  return storageDuration !== null ? Number(storageDuration) : undefined;
};

export const retrieveBounds = (): BoundsInMilliseconds | undefined => {
  const urlBounds = HistoryManager.getTimeBounds();
  if (urlBounds !== undefined) {
    sessionStorage.setItem(URLParam.FROM, String(urlBounds.from));
    if (urlBounds.to !== undefined) {
      sessionStorage.setItem(URLParam.TO, String(urlBounds.to));
    }
    return urlBounds;
  }
  const storageFrom = sessionStorage.getItem(URLParam.FROM);
  if (storageFrom !== null) {
    const storageTo = sessionStorage.getItem(URLParam.TO);
    return {
      from: Number(storageFrom),
      to: storageTo !== null ? Number(storageTo) : undefined
    };
  }
  return undefined;
};

export const retrieveTimeRange = (): TimeRange | undefined => {
  const ft = retrieveBounds();
  return ft ? ft : retrieveDuration();
};

export const storeDuration = (duration: DurationInSeconds) => {
  sessionStorage.setItem(URLParam.DURATION, String(duration));
  HistoryManager.setParam(URLParam.DURATION, String(duration));
  sessionStorage.removeItem(URLParam.FROM);
  HistoryManager.deleteParam(URLParam.FROM);
  sessionStorage.removeItem(URLParam.TO);
  HistoryManager.deleteParam(URLParam.TO);
};

export const storeBounds = (bounds: BoundsInMilliseconds) => {
  sessionStorage.setItem(URLParam.FROM, String(bounds.from));
  HistoryManager.setParam(URLParam.FROM, String(bounds.from));
  if (bounds.to) {
    sessionStorage.setItem(URLParam.TO, String(bounds.to));
    HistoryManager.setParam(URLParam.TO, String(bounds.to));
  } else {
    sessionStorage.removeItem(URLParam.TO);
    HistoryManager.deleteParam(URLParam.TO);
  }
  sessionStorage.removeItem(URLParam.DURATION);
  HistoryManager.deleteParam(URLParam.DURATION);
};

export const storeTimeRange = (range: TimeRange) => {
  guardTimeRange(range, storeDuration, storeBounds);
};

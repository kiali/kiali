import { createBrowserHistory } from 'history';

const webRoot = (window as any).WEB_ROOT ? (window as any).WEB_ROOT : undefined;
const baseName = webRoot && webRoot !== '/' ? webRoot + '/console' : '/console';
const history = createBrowserHistory({ basename: baseName });

export default history;

export enum URLParams {
  POLL_INTERVAL = 'pi',
  DURATION = 'duration',
  REPORTER = 'reporter',
  SHOW_AVERAGE = 'avg',
  QUANTILES = 'quantiles',
  BY_LABELS = 'bylbl'
}

export namespace HistoryManager {
  export const setParam = (name: URLParams, value: string) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(name, value);
    history.replace(history.location.pathname + '?' + urlParams.toString());
  };

  export const getParam = (name: URLParams): string | null => {
    const urlParams = new URLSearchParams(history.location.search);
    return urlParams.get(name);
  };
}

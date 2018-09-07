import { createBrowserHistory } from 'history';

const baseName = '/console';
const history = createBrowserHistory({ basename: baseName });
export default history;

export namespace HistoryManager {
  export const setParam = (name: string, value: string) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(name, value);
    history.replace(history.location.pathname + '?' + urlParams.toString());
  };

  export const getParam = (name: string): string | null => {
    const urlParams = new URLSearchParams(history.location.search);
    return urlParams.get(name);
  };
}

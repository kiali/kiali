import { createBrowserHistory } from 'history';

const webRoot = (window as any).WEB_ROOT ? (window as any).WEB_ROOT : undefined;
const baseName = webRoot && webRoot !== '/' ? webRoot + '/console' : '/console';
const history = createBrowserHistory({ basename: baseName });

export default history;

import { createBrowserHistory } from 'history';

const baseName = '/console';
const history = createBrowserHistory({ basename: baseName });
export default history;

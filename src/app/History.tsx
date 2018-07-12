import { createBrowserHistory } from 'history';
import { baseName } from '../routes';

const history = createBrowserHistory({ basename: baseName });
export default history;

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from '../App';

it('renders full App without crashing', () => {
  // jest.mock('../../services/Api');

  process.env.REACT_APP_NAME = 'kiali-ui-test';
  process.env.REACT_APP_VERSION = '1.0.1';
  process.env.REACT_APP_GIT_HASH = '89323';

  // TODO: properly handle SVG and D3 in the following 2 components
  jest.mock('../../components/SummaryPanel/RpsChart');

  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
});

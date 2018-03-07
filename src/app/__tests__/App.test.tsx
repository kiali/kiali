import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from '../App';

const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

// Mock graph component due to direct DOM/div access
jest.mock('../../components/CytoscapeLayout/CytoscapeLayout');

const mock = new MockAdapter(axios);
mock.onAny().reply(200);

process.env.REACT_APP_NAME = 'swsui-test';
process.env.REACT_APP_VERSION = '1.0.1';
process.env.REACT_APP_GIT_HASH = '89323';

it('renders full App without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
});

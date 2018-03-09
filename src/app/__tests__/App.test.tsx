import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from '../App';
import 'jest-canvas-mock';

const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

// Mock getComputedStyle: Cytoscape relies on the result of this to have a valid paddingXXX
// Current implementation returns '' which is parsed to float as NAN, breaking cytoscape.
// Uses the default implementation and ensures we are returning a valid paddingXXX
const defaultGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = jest.fn().mockImplementation(element => {
  const computedStyle = defaultGetComputedStyle(element);
  for (let prop of ['paddingTop', 'paddingRight', 'paddingLeft', 'paddingBottom']) {
    if (computedStyle[prop] === '') {
      computedStyle[prop] = '0px';
    }
  }
  return computedStyle;
});

const mock = new MockAdapter(axios);
mock.onAny().reply(200);

process.env.REACT_APP_NAME = 'swsui-test';
process.env.REACT_APP_VERSION = '1.0.1';
process.env.REACT_APP_GIT_HASH = '89323';

it('renders full App without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
});

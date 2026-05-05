import * as React from 'react';
import { render } from '@testing-library/react';
import { App } from '../App';

it('renders full App without crashing', () => {
  process.env.REACT_APP_NAME = 'kiali-ui-test';
  process.env.REACT_APP_VERSION = '1.0.1';
  process.env.REACT_APP_GIT_HASH = '89323';

  render(<App />);
});

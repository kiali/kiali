import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from '../App';

// Skipping full App rendering for now until we properly mock Cytoscape
test.skip('renders App without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
});

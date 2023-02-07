import './polyfills';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './app/App';
import './styles/index.css';

declare global {
  interface Date {
    toLocaleStringWithConditionalDate(): string;
  }
}

// eslint-disable-next-line no-extend-native
Date.prototype.toLocaleStringWithConditionalDate = function () {
  const nowDate = new Date().toLocaleDateString();
  const thisDate = this.toLocaleDateString();

  return nowDate === thisDate ? this.toLocaleTimeString() : this.toLocaleString();
};

ReactDOM.render(<App />, document.getElementById('root') as HTMLElement);

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './app/App';
import './styles/index.css';

// Declare a new interface for the Date object to add the new method toLocaleStringWithConditionalDate
declare global {
  interface Date {
    toLocaleStringWithConditionalDate(): string;
  }
}

// Extend the Date object to add the new method toLocaleStringWithConditionalDate
// eslint-disable-next-line no-extend-native
Date.prototype.toLocaleStringWithConditionalDate = function () {
  // Get the locale date string for the current date
  const nowDate = new Date().toLocaleDateString();
  // Get the locale date string for the date this method is being called on
  const thisDate = this.toLocaleDateString();

  // Return the locale time string if the dates are the same, otherwise return the locale string
  return nowDate === thisDate ? this.toLocaleTimeString() : this.toLocaleString();
};

// Get the element with id "root"
const rootElement = document.getElementById('root');

// If the root element exists, render the App component to it
if (rootElement) {
  ReactDOM.render(<App />, rootElement);
}

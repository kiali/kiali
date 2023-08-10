import * as Enzyme from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
require('jest-localstorage-mock');
require('jest-canvas-mock');

var JSDOM = require('jsdom').JSDOM;

global.window = new JSDOM().window;
window.SVGPathElement = function () {};
window.customElements = function () {};
window.customElements.define = function () {};

// Mock local storage
const localStorageMock = (() => {
  var store = {};
  return {
    getItem: function (key: string) {
      return store[key];
    },
    setItem: function (key: string, value: unknown) {
      store[key] = String(value);
    },
    clear: function () {
      store = {};
    },
    removeItem: function (key: string) {
      delete store[key];
    }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

Enzyme.configure({ adapter: new Adapter() });

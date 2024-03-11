import * as Enzyme from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
require('jest-canvas-mock');

let JSDOM = require('jsdom').JSDOM;

if (!global.window) {
  global.window = new JSDOM().window;
}

window.SVGPathElement = function () {};
window.customElements = function () {};
window.customElements.define = function () {};

Enzyme.configure({ adapter: new Adapter() });

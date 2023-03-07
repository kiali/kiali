import * as Enzyme from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
require('jest-localstorage-mock');
require('jest-canvas-mock');

var JSDOM = require('jsdom').JSDOM;

global.window = new JSDOM().window;
window.SVGPathElement = function () {};
window.customElements = function () {};
window.customElements.define = function () {};

Enzyme.configure({ adapter: new Adapter() });

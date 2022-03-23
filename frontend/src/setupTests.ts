import * as Enzyme from 'enzyme';
require('jest-localstorage-mock');
require('jest-canvas-mock');
const Adapter = require('enzyme-adapter-react-16');

var JSDOM = require('jsdom').JSDOM;

global.window = new JSDOM().window;
window.SVGPathElement = function () {};
window.customElements = function () {};
window.customElements.define = function () {};

Enzyme.configure({ adapter: new Adapter() });

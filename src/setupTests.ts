import * as Enzyme from 'enzyme';
require('jest-localstorage-mock');
const Adapter = require('enzyme-adapter-react-16');

Enzyme.configure({ adapter: new Adapter() });

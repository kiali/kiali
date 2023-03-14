import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import enzyme from 'enzyme';

const { configure } = enzyme;

configure({ adapter: new Adapter() });
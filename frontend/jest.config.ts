import { jest } from '@jest/globals';
import { configure } from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';

import 'jest-canvas-mock';

configure({ adapter: new Adapter() });

jest.mock('i18n', () => ({
  i18n: {
    t: (key: string) => key,
    changeLanguage: () => new Promise(() => {})
  }
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  }),
  withTranslation: () => (component: any) => {
    component.defaultProps = { ...component.defaultProps, t: (key: string) => key };
    return component;
  }
}));

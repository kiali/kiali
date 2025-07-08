import * as API from '../Api';
import { mount, ReactWrapper } from 'enzyme';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { store } from '../../store/ConfigStore';

export class MounterMocker {
  private promises: Promise<void>[] = [];
  private toMount: JSX.Element = (<></>);
  private caughtErrors: string[] = [];

  constructor() {
    store.subscribe(() => {
      this.caughtErrors = [];
      const state = store.getState();
      state.messageCenter.groups.forEach(g => {
        g.messages.forEach(m => {
          this.caughtErrors.push(`${m.content} [${m.detail}]`);
        });
      });
    });
  }

  // About nestData: set it accordingly to the object returned by API promise:
  // - if it's the Api response directly, keep default (true) as content is encapsulated in 'data' field
  // - if it's a transformed object extracted from Api response, set to false.
  addMock = (func: any, obj: any, nestData = true): MounterMocker => {
    this.promises.push(
      new Promise((resolve, reject) => {
        jest.spyOn(API, func).mockImplementation(() => {
          return new Promise(r => {
            nestData ? r({ data: obj }) : r(obj);
            setTimeout(() => {
              try {
                resolve();
              } catch (e) {
                reject(e);
              }
            }, 1);
          });
        });
      })
    );
    return this;
  };

  mount = (elem: JSX.Element): MounterMocker => {
    this.toMount = elem;
    return this;
  };

  mountWithStore = (elem: JSX.Element): MounterMocker => {
    this.toMount = (
      <Provider store={store}>
        <MemoryRouter>{elem}</MemoryRouter>
      </Provider>
    );

    return this;
  };

  run = (done: jest.DoneCallback, expect: (wrapper: ReactWrapper) => void): void => {
    let wrapper: ReactWrapper;

    Promise.all(this.promises)
      .then(() => {
        wrapper.update();
        this.checkErrors();
        expect(wrapper);
        done();
      })
      .catch(done.fail);

    wrapper = mount(this.toMount);
  };

  private checkErrors(): void {
    if (this.caughtErrors.length > 0) {
      console.warn(`MounterMocker caught some errors:${this.caughtErrors.map(e => `\n- ${e}`).join('')}`);
    }
  }
}

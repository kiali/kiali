import JaegerState from '../JaegerState';
import { JaegerActions } from '../../actions/JaegerActions';

const initialState = {
  jaegerURL: '',
  enableIntegration: false
};

describe('JaegerState reducer', () => {
  let expectedState;
  beforeEach(() => {
    expectedState = initialState;
  });

  it('should set url', () => {
    const url = 'https://jaeger-query-istio-system.127.0.0.1.nip.io';
    expectedState.jaegerURL = url;
    expect(JaegerState(initialState, JaegerActions.setUrl(url))).toEqual(expectedState);
  });

  it('should enable integration', () => {
    expectedState.enableIntegration = true;
    expect(JaegerState(initialState, JaegerActions.setEnableIntegration(true))).toEqual(expectedState);
  });
});

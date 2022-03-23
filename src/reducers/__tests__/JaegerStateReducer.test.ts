import { JaegerStateReducer, JaegerState } from '../JaegerState';
import { JaegerActions } from '../../actions/JaegerActions';

const initialState: JaegerState = {
  info: {
    enabled: false,
    integration: false,
    url: '',
    namespaceSelector: true,
    whiteListIstioSystem: []
  }
};

describe('JaegerState reducer', () => {
  let expectedState: JaegerState;
  beforeEach(() => {
    expectedState = initialState;
  });

  it('should store both url and integration', () => {
    const url = 'https://jaeger-query-istio-system.127.0.0.1.nip.io';
    expectedState.info!.enabled = true;
    expectedState.info!.integration = true;
    expectedState.info!.url = url;
    expect(
      JaegerStateReducer(
        initialState,
        JaegerActions.setInfo({
          url: url,
          enabled: true,
          integration: true,
          namespaceSelector: true,
          whiteListIstioSystem: []
        })
      )
    ).toEqual(expectedState);
  });
});

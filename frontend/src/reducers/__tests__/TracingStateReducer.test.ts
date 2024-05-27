import { TracingStateReducer, TracingState } from '../TracingState';
import { TracingActions } from '../../actions/TracingActions';

const initialState: TracingState = {
  info: {
    enabled: false,
    integration: false,
    url: '',
    namespaceSelector: true,
    provider: 'jaeger',
    whiteListIstioSystem: [],
    timeout: 5
  }
};

describe('TracingState reducer', () => {
  let expectedState: TracingState;
  beforeEach(() => {
    expectedState = initialState;
  });

  it('should store both url and integration', () => {
    const url = 'https://jaeger-query-istio-system.127.0.0.1.nip.io';
    expectedState.info!.enabled = true;
    expectedState.info!.integration = true;
    expectedState.info!.url = url;
    expect(
      TracingStateReducer(
        initialState,
        TracingActions.setInfo({
          url: url,
          enabled: true,
          integration: true,
          namespaceSelector: true,
          provider: 'jaeger',
          whiteListIstioSystem: [],
          timeout: 5
        })
      )
    ).toEqual(expectedState);
  });
});

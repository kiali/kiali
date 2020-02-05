import JaegerState from '../JaegerState';
import { JaegerActions } from '../../actions/JaegerActions';
import { JaegerInfo } from 'types/JaegerInfo';

const initialState: JaegerInfo = {
  enabled: false,
  integration: false,
  url: '',
  namespaceSelector: true
};

describe('JaegerState reducer', () => {
  let expectedState: JaegerInfo;
  beforeEach(() => {
    expectedState = initialState;
  });

  it('should store both url and integration', () => {
    const url = 'https://jaeger-query-istio-system.127.0.0.1.nip.io';
    expectedState.enabled = true;
    expectedState.integration = true;
    expectedState.url = url;
    expect(
      JaegerState(
        initialState,
        JaegerActions.setInfo({ url: url, enabled: true, integration: true, namespaceSelector: true })
      )
    ).toEqual(expectedState);
  });
});

import { TracingActions } from '../TracingActions';
import { getType } from 'typesafe-actions';

describe('JaegerActions', () => {
  it('should "update url" action', () => {
    const showAction = TracingActions.setInfo({
      enabled: true,
      integration: true,
      url: 'jaeger-query-istio-system.127.0.0.1.nip.io',
      internal_url: '',
      namespaceSelector: true,
      provider: 'jaeger',
      whiteListIstioSystem: ['jaeger-query']
    });
    expect(showAction.type).toEqual(getType(TracingActions.setInfo));
    expect(showAction.payload!.url).toEqual('jaeger-query-istio-system.127.0.0.1.nip.io');
  });
});

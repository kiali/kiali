import { JaegerActions } from '../JaegerActions';
import { getType } from 'typesafe-actions';

describe('JaegerActions', () => {
  it('should "update url" action', () => {
    const showAction = JaegerActions.setInfo({
      enabled: true,
      integration: true,
      url: 'jaeger-query-istio-system.127.0.0.1.nip.io',
      namespaceSelector: true,
      whiteListIstioSystem: ['jaeger-query']
    });
    expect(showAction.type).toEqual(getType(JaegerActions.setInfo));
    expect(showAction.payload!.url).toEqual('jaeger-query-istio-system.127.0.0.1.nip.io');
  });
});

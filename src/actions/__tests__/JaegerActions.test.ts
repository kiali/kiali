import { JaegerActions } from '../JaegerActions';
import { getType } from 'typesafe-actions';

describe('JaegerActions', () => {
  it('should "update url" action', () => {
    const showAction = JaegerActions.setUrl('jaeger-query-istio-system.127.0.0.1.nip.io');
    expect(showAction.type).toEqual(getType(JaegerActions.setUrl));
    expect(showAction.payload).toEqual({
      url: 'jaeger-query-istio-system.127.0.0.1.nip.io'
    });
  });
});

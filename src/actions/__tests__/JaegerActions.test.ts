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

  it('should "receive list of services" action', () => {
    const services = ['details', 'productpage'];
    const showAction = JaegerActions.receiveList(services);
    expect(showAction.type).toEqual(getType(JaegerActions.receiveList));
    expect(showAction.payload).toEqual({
      list: services
    });
  });

  it('should "update custom lookback" action', () => {
    const start = '1544432675600000';
    const end = '1544432625600000';
    const showAction = JaegerActions.setCustomLookback(start, end);
    expect(showAction.type).toEqual(getType(JaegerActions.setCustomLookback));
    expect(showAction.payload).toEqual({
      start: start,
      end: end
    });
  });

  it('should "update durations" action', () => {
    const min = '10ms';
    const max = '10s';
    const showAction = JaegerActions.setDurations(min, max);
    expect(showAction.type).toEqual(getType(JaegerActions.setDurations));
    expect(showAction.payload).toEqual({
      min: min,
      max: max
    });
  });
});

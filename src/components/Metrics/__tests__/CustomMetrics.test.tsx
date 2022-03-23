import * as React from 'react';
import CustomMetrics from '../CustomMetrics';
import MounterMocker from 'services/__mocks__/MounterMocker';

describe('Custom metrics', () => {
  it('mounts and loads empty metrics', done => {
    new MounterMocker()
      .addMock('getCustomDashboard', { title: 'foo', aggregations: [], charts: [], externalLinks: [] })
      .mountWithStore(<CustomMetrics namespace="ns" app="test" template="vertx" />)
      .run(done, wrapper => {
        expect(wrapper.find('GridItem')).toHaveLength(0);
      });
  });
});

import { groupPods } from '../ServiceInfoPodsGrouping';
import { Pod } from '../../../../types/IstioObjects';

const pods: Pod[] = [
  {
    name: 'reviews-v1-1234',
    labels: { app: 'reviews', version: 'v1' },
    createdAt: '2018-03-14T10:00:00Z',
    createdBy: [
      {
        kind: 'ReplicaSet',
        name: 'reviews-v1'
      }
    ],
    istioContainers: [
      {
        image: 'istio-image',
        name: 'istio-container'
      }
    ],
    istioInitContainers: [
      {
        image: 'istio-init-image',
        name: 'istio-init-container'
      }
    ],
    status: '',
    appLabel: false,
    versionLabel: false
  },
  {
    name: 'reviews-v2-1234',
    labels: { app: 'reviews', version: 'v2' },
    createdAt: '2018-03-14T10:00:00Z',
    createdBy: [
      {
        kind: 'ReplicaSet',
        name: 'reviews-v2'
      }
    ],
    istioContainers: [
      {
        image: 'istio-image',
        name: 'istio-container'
      }
    ],
    istioInitContainers: [
      {
        image: 'istio-init-image',
        name: 'istio-init-container'
      }
    ],
    status: '',
    appLabel: false,
    versionLabel: false
  },
  {
    name: 'reviews-v2-5678',
    labels: { app: 'reviews', version: 'v2', foo: 'bar' },
    createdAt: '2018-03-14T11:00:00Z',
    createdBy: [
      {
        kind: 'ReplicaSet',
        name: 'reviews-v2'
      }
    ],
    istioContainers: [
      {
        image: 'istio-image',
        name: 'istio-container'
      }
    ],
    istioInitContainers: [
      {
        image: 'istio-init-image',
        name: 'istio-init-container'
      }
    ],
    status: '',
    appLabel: false,
    versionLabel: false
  },
  {
    name: 'reviews-v2-9999',
    labels: { app: 'reviews', version: 'v2' },
    createdAt: '2018-03-14T12:00:00Z',
    createdBy: [
      {
        kind: 'ReplicaSet',
        name: 'reviews-v2'
      }
    ],
    istioContainers: [
      {
        image: 'istio-image',
        name: 'istio-container'
      }
    ],
    istioInitContainers: [
      {
        image: 'istio-init-image',
        name: 'istio-init-container'
      }
    ],
    status: '',
    appLabel: false,
    versionLabel: false
  }
];

describe('#ServiceInfoPodsGrouping', () => {
  it('should group pods of same reference', () => {
    const groups = groupPods(pods);
    expect(groups).toHaveLength(2);

    expect(groups[0].commonPrefix).toBe('reviews-v1-1234');
    expect(groups[0].numberOfPods).toBe(1);
    expect(groups[0].names).toEqual(['reviews-v1-1234']);
    expect(groups[0].commonLabels).toEqual({ app: 'reviews', version: 'v1' });
    expect(groups[0].createdAtStart).toEqual(new Date('2018-03-14T10:00:00Z').getTime());
    expect(groups[0].createdAtEnd).toEqual(new Date('2018-03-14T10:00:00Z').getTime());
    expect(groups[0].createdBy[0].name).toEqual('reviews-v1');
    expect(groups[0].istioContainers).toHaveLength(1);
    expect(groups[0].istioInitContainers).toHaveLength(1);

    expect(groups[1].commonPrefix).toBe('reviews-v2-');
    expect(groups[1].numberOfPods).toBe(3);
    expect(groups[1].names).toEqual(['reviews-v2-1234', 'reviews-v2-5678', 'reviews-v2-9999']);
    expect(groups[1].commonLabels).toEqual({ app: 'reviews', version: 'v2' });
    expect(groups[1].createdAtStart).toEqual(new Date('2018-03-14T10:00:00Z').getTime());
    expect(groups[1].createdAtEnd).toEqual(new Date('2018-03-14T12:00:00Z').getTime());
    expect(groups[1].createdBy[0].name).toEqual('reviews-v2');
    expect(groups[1].istioContainers).toHaveLength(1);
    expect(groups[1].istioInitContainers).toHaveLength(1);
  });
});

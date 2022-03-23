import { PFColors } from '../../components/Pf/PfColors';
import { NodeType } from '../../types/Graph';

export const TEST = {
  elements: {
    nodes: [
      {
        data: {
          id: 'n2',
          text: 'details (v1)',
          service: 'details.istio-system.svc.cluster.local',
          version: 'v1',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n1',
          text: 'productpage (v1)',
          service: 'productpage.istio-system.svc.cluster.local',
          version: 'v1',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n3',
          text: 'reviews (v1)',
          service: 'reviews.istio-system.svc.cluster.local',
          version: 'v1',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n0',
          text: 'unknown',
          service: 'unknown',
          version: 'unknown',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      }
    ],
    edges: [
      {
        data: {
          id: 'e0',
          source: 'n0',
          target: 'n1',
          text: '12.54pm',
          color: PFColors.Success
        }
      },
      {
        data: {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          text: '12.54pm',
          color: PFColors.Success
        }
      },
      {
        data: {
          id: 'e2',
          source: 'n1',
          target: 'n3',
          text: '12.54pm',
          color: PFColors.Success
        }
      }
    ]
  }
};

export const ISTIO_SYSTEM = {
  elements: {
    nodes: [
      {
        data: {
          id: 'n2',
          text: 'details (v1)',
          service: 'details.istio-system.svc.cluster.local',
          version: 'v1',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n1',
          text: 'productpage (v1)',
          service: 'productpage.istio-system.svc.cluster.local',
          version: 'v1',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n5',
          text: 'ratings (v1)',
          service: 'ratings.istio-system.svc.cluster.local',
          version: 'v1',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n7',
          text: 'reviews',
          service: 'reviews.istio-system.svc.cluster.local',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n3',
          text: 'reviews (v1)',
          parent: 'n7',
          service: 'reviews.istio-system.svc.cluster.local',
          version: 'v1',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n4',
          text: 'reviews (v2)',
          parent: 'n7',
          service: 'reviews.istio-system.svc.cluster.local',
          version: 'v2',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n6',
          text: 'reviews ( v3 )',
          parent: 'n7',
          service: 'reviews.istio-system.svc.cluster.local',
          version: 'v3',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      },
      {
        data: {
          id: 'n0',
          text: 'unknown',
          service: 'unknown',
          version: 'unknown',
          cluster: `cluster-1`,
          namespace: 'istio-system',
          nodeType: NodeType.APP
        }
      }
    ],
    edges: [
      {
        data: {
          id: 'e0',
          source: 'n0',
          target: 'n1',
          text: '0ps',
          color: PFColors.Black1000
        }
      },
      {
        data: {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          text: '0ps',
          color: PFColors.Black1000
        }
      },
      {
        data: {
          id: 'e2',
          source: 'n1',
          target: 'n3',
          text: '0ps',
          color: PFColors.Black1000
        }
      },
      {
        data: {
          id: 'e3',
          source: 'n1',
          target: 'n4',
          text: '0ps',
          color: PFColors.Black1000
        }
      },
      {
        data: {
          id: 'e5',
          source: 'n1',
          target: 'n6',
          text: '0ps',
          color: PFColors.Black1000
        }
      },
      {
        data: {
          id: 'e4',
          source: 'n4',
          target: 'n5',
          text: '0ps',
          color: PFColors.Black1000
        }
      },
      {
        data: {
          id: 'e6',
          source: 'n6',
          target: 'n5',
          text: '0ps',
          color: PFColors.Black1000
        }
      }
    ]
  }
};

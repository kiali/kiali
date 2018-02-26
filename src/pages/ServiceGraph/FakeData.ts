// This class has some static Fake data in cytoscape format
// This is just temporary until real data from backend is hooked up
// It is very useful for tweaking the data and retesting
export class FakeData {
  static getElements() {
    return {
      nodes: [
        {
          data: {
            id: 'n0',
            service: 'productpage.istio-system.svc.cluster.local',
            version: 'v1',
            text: 'productpage (v1)',
            link_prom_graph:
              'http://prometheus:9090/graph?g0.range_input=1h&g0.tab=0&g0.expr=istio_request_count%7Bdestination_service%3D%22productpage.istio-system.svc.cluster.local%22%2Cdestination_version%3D%22v1%22%7D'
          }
        },
        {
          data: {
            id: 'n1',
            service: 'reviews.istio-system.svc.cluster.local',
            version: 'v2',
            text: 'reviews (v2)',
            parent: 'n6',
            link_prom_graph:
              'http://prometheus:9090/graph?g0.range_input=1h&g0.tab=0&g0.expr=istio_request_count%7Bdestination_service%3D%22reviews.istio-system.svc.cluster.local%22%2Cdestination_version%3D%22v2%22%7D'
          }
        },
        {
          data: {
            id: 'n2',
            service: 'ratings.istio-system.svc.cluster.local',
            version: 'v1',
            text: 'ratings (v1)',
            link_prom_graph:
              'http://prometheus:9090/graph?g0.range_input=1h&g0.tab=0&g0.expr=istio_request_count%7Bdestination_service%3D%22ratings.istio-system.svc.cluster.local%22%2Cdestination_version%3D%22v1%22%7D'
          }
        },
        {
          data: {
            id: 'n3',
            service: 'reviews.istio-system.svc.cluster.local',
            version: 'v3',
            text: 'reviews (v3)',
            parent: 'n6',
            link_prom_graph:
              'http://prometheus:9090/graph?g0.range_input=1h&g0.tab=0&g0.expr=istio_request_count%7Bdestination_service%3D%22reviews.istio-system.svc.cluster.local%22%2Cdestination_version%3D%22v3%22%7D'
          }
        },
        {
          data: {
            id: 'n4',
            service: 'details.istio-system.svc.cluster.local',
            version: 'v1',
            text: 'details (v1)',
            link_prom_graph:
              'http://prometheus:9090/graph?g0.range_input=1h&g0.tab=0&g0.expr=istio_request_count%7Bdestination_service%3D%22details.istio-system.svc.cluster.local%22%2Cdestination_version%3D%22v1%22%7D'
          }
        },
        {
          data: {
            id: 'n5',
            service: 'reviews.istio-system.svc.cluster.local',
            version: 'v1',
            text: 'reviews (v1)',
            parent: 'n6',
            link_prom_graph:
              'http://prometheus:9090/graph?g0.range_input=1h&g0.tab=0&g0.expr=istio_request_count%7Bdestination_service%3D%22reviews.istio-system.svc.cluster.local%22%2Cdestination_version%3D%22v1%22%7D'
          }
        },
        {
          data: {
            id: 'n6',
            service: 'reviews.istio-system.svc.cluster.local',
            text: 'reviews',
            color: '#bbb'
          }
        }
      ],
      edges: [
        {
          data: {
            id: 'e0',
            source: 'n0',
            target: 'n1',
            text: 'rpm=0',
            color: 'black'
          }
        },
        {
          data: {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            text: 'rpm=0.7',
            color: 'orange'
          }
        },
        {
          data: {
            id: 'e2',
            source: 'n0',
            target: 'n3',
            text: 'rpm=0',
            color: 'black'
          }
        },
        {
          data: {
            id: 'e3',
            source: 'n3',
            target: 'n2',
            text: 'rpm=0',
            color: 'black'
          }
        },
        {
          data: {
            id: 'e4',
            source: 'n0',
            target: 'n4',
            text: 'rpm=0',
            color: 'black'
          }
        },
        {
          data: {
            id: 'e5',
            source: 'n0',
            target: 'n5',
            text: 'rpm=0',
            color: 'black'
          }
        }
      ]
    };
  }
}

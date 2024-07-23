import * as React from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { GraphPage, GraphURLPathProps } from 'pages/Graph/GraphPage';

/**
 * Graph wrapper to add routing parameters to GraphPage
 * Some platforms where Kiali is deployed reuse GraphPage but
 * do not work with react-router params (like Openshift Console)
 */
export const GraphRoute: React.FC = () => {
  const { aggregate, aggregateValue, app, namespace, service, version, workload } = useParams<GraphURLPathProps>();

  return (
    <GraphPage
      aggregate={aggregate}
      aggregateValue={aggregateValue}
      app={app}
      namespace={namespace}
      service={service}
      version={version}
      workload={workload}
    ></GraphPage>
  );
};

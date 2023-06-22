import * as React from 'react';
import { useParams } from 'react-router';
import GraphPage, { GraphURLPathProps } from 'pages/Graph/GraphPage';

const GraphRoute = () => {
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

export default GraphRoute;

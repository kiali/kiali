import * as React from 'react';
import { useParams } from 'react-router';
import type { GraphURLPathProps } from 'pages/Graph/GraphPage';
import { GraphPage } from 'pages/Graph/GraphPage';

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

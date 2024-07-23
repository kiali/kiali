import * as React from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { GraphPagePF, GraphURLPathProps } from 'pages/GraphPF/GraphPagePF';

export const GraphRoutePF: React.FC = () => {
  const { aggregate, aggregateValue, app, namespace, service, version, workload } = useParams<GraphURLPathProps>();

  return (
    <GraphPagePF
      aggregate={aggregate}
      aggregateValue={aggregateValue}
      app={app}
      namespace={namespace}
      service={service}
      version={version}
      workload={workload}
    ></GraphPagePF>
  );
};

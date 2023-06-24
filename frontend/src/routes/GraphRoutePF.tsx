import * as React from 'react';
import { useParams } from 'react-router';
import GraphPagePF, { GraphURLPathProps } from 'pages/GraphPF/GraphPagePF';

const GraphRoutePF = () => {
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

export default GraphRoutePF;

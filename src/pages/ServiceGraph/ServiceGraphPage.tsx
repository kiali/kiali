import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import NamespaceId from '../../types/NamespaceId';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';

export default function ServiceGraphPage(routeProps: RouteComponentProps<NamespaceId>) {
  const namespace = routeProps.match.params.namespace;

  return (
    <div className="container-fluid container-pf-nav-pf-vertical">
      <div className="page-header">
        <h2>Services Graph for namespace: {namespace} </h2>
      </div>
      <div style={{ height: 600 }}>
        <CytoscapeLayout namespace={namespace} />
      </div>
    </div>
  );
}

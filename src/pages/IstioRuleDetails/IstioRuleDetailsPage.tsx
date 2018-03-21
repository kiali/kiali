import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import RuleId from '../../types/RuleId';
import { NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { ActiveFilter } from '../../types/NamespaceFilter';
import IstioRuleInfo from './IstioRuleInfo';

const IstioRuleDetailsPage = (routeProps: RouteComponentProps<RuleId>) => {
  let updateFilter = () => {
    let activeFilter: ActiveFilter = {
      label: 'Namespace: ' + routeProps.match.params.namespace,
      category: 'Namespace',
      value: routeProps.match.params.namespace.toString()
    };
    NamespaceFilterSelected.setSelected([activeFilter]);
  };

  return (
    <div className="container-fluid container-pf-nav-pf-vertical">
      <div className="page-header">
        <h2>
          Istio Mixer Rule{' '}
          <Link to="/rules" onClick={updateFilter}>
            {routeProps.match.params.namespace}
          </Link>{' '}
          / {routeProps.match.params.rule}
        </h2>
      </div>
      <IstioRuleInfo namespace={routeProps.match.params.namespace} rule={routeProps.match.params.rule} />
    </div>
  );
};

export default IstioRuleDetailsPage;

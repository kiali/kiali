import * as React from 'react';
import * as API from '../../services/Api';
import { RouteComponentProps } from 'react-router-dom';
import PropTypes from 'prop-types';
import NamespaceId from '../../types/NamespaceId';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';
import { DropdownButton, MenuItem } from 'patternfly-react';

type ServiceGraphPageProps = {
  availableNamespaces: { name: string }[];
  graphNamespace: string;
};

export default class ServiceGraphPage extends React.Component<RouteComponentProps<NamespaceId>, ServiceGraphPageProps> {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(routeProps: RouteComponentProps<NamespaceId>) {
    super(routeProps);
    this.namespaceSelected = this.namespaceSelected.bind(this);

    this.state = {
      availableNamespaces: [],
      graphNamespace: routeProps.match.params.namespace
    };

    this.populateNamespacesSelect = this.populateNamespacesSelect.bind(this);
  }

  componentDidMount() {
    API.GetNamespaces().then(this.populateNamespacesSelect);
  }

  componentWillReceiveProps(nextProps: RouteComponentProps<NamespaceId>) {
    this.setState({ graphNamespace: nextProps.match.params.namespace });
  }

  populateNamespacesSelect(response: any) {
    this.setState({ availableNamespaces: response['data'] });
  }

  namespaceSelected(selectedNamespace: string) {
    this.context.router.history.push(`/service-graph/${selectedNamespace}`);
  }

  render() {
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
        <div className="page-header">
          <h2>
            Services Graph for namespace:&nbsp;
            <DropdownButton
              id="namespace-selector"
              title={this.state.graphNamespace}
              onSelect={this.namespaceSelected}
              bsSize="large"
            >
              {this.state.availableNamespaces.map(ns => (
                <MenuItem key={ns.name} active={ns.name === this.state.graphNamespace} eventKey={ns.name}>
                  {ns.name}
                </MenuItem>
              ))}
            </DropdownButton>
          </h2>
        </div>
        <CytoscapeLayout namespace={this.state.graphNamespace} />
      </div>
    );
  }
}

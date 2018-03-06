import * as React from 'react';
import * as API from '../../services/Api';
import { RouteComponentProps } from 'react-router-dom';
import PropTypes from 'prop-types';
import NamespaceId from '../../types/NamespaceId';
import CytoscapeLayout from '../../components/CytoscapeLayout/CytoscapeLayout';
import { DropdownButton, MenuItem, Alert } from 'patternfly-react';
import CytoscapeToolbar from './CytoscapeToolbar';
import PfContainerNavVertical from '../../components/Pf/PfContainerNavVertical';
import PfHeader from '../../components/Pf/PfHeader';
import { DagreGraph } from '../../components/CytoscapeLayout/graphs/DagreGraph';
import { ColaGraph } from '../../components/CytoscapeLayout/graphs/ColaGraph';
import { BreadthFirstGraph } from '../../components/CytoscapeLayout/graphs/BreadthFirstGraph';
import SummaryPanel from './SummaryPanel';

type ServiceGraphPageProps = {
  availableNamespaces: { name: string }[];
  graphNamespace: string;
  alertVisible: boolean;
  alertDetails: string;
  layout: any;
};

export default class ServiceGraphPage extends React.Component<RouteComponentProps<NamespaceId>, ServiceGraphPageProps> {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(routeProps: RouteComponentProps<NamespaceId>) {
    super(routeProps);
    this.state = {
      availableNamespaces: [],
      graphNamespace: routeProps.match.params.namespace,
      alertVisible: false,
      alertDetails: '',
      layout: 'Cola'
    };

    this.populateNamespacesSelect = this.populateNamespacesSelect.bind(this);
  }

  componentDidMount() {
    API.GetNamespaces()
      .then(this.populateNamespacesSelect)
      .catch(namespacesError => {
        console.error(JSON.stringify(namespacesError));
        this.handleError('Error fetching namespace list.');
      });
  }

  componentWillReceiveProps(nextProps: RouteComponentProps<NamespaceId>) {
    this.setState({ graphNamespace: nextProps.match.params.namespace });
  }

  populateNamespacesSelect(response: any) {
    const namespaces = response['data'] ? response['data'] : [];
    this.setState({ availableNamespaces: namespaces });
  }

  namespaceSelected = (selectedNamespace: string) => {
    this.context.router.history.push(`/service-graph/${selectedNamespace}`);
  };

  clickGraphType = (name: string) => {
    if (name === 'Dagre') {
      this.setState({ layout: DagreGraph.getLayout() });
    } else if (name === 'Cola') {
      this.setState({ layout: ColaGraph.getLayout() });
    } else if (name === 'Breadthfirst') {
      this.setState({ layout: BreadthFirstGraph.getLayout() });
    } else {
      this.setState({ layout: DagreGraph.getLayout() });
    }
  };

  handleError = (error: string) => {
    this.setState({ alertVisible: true, alertDetails: error });
  };

  dismissAlert = () => {
    this.setState({ alertVisible: false });
  };

  render() {
    let alertsDiv = <div />;
    if (this.state.alertVisible) {
      alertsDiv = (
        <div>
          <Alert onDismiss={this.dismissAlert}>{this.state.alertDetails.toString()}</Alert>
        </div>
      );
    }
    return (
      <PfContainerNavVertical>
        <PfHeader>
          <h2>
            Services Graph for namespace:
            <DropdownButton
              id="namespace-selector"
              title={this.state.graphNamespace}
              onSelect={this.namespaceSelected}
              style={{ marginLeft: 20 }}
              bsSize="large"
            >
              {this.state.availableNamespaces.map(ns => (
                <MenuItem key={ns.name} active={ns.name === this.state.graphNamespace} eventKey={ns.name}>
                  {ns.name}
                </MenuItem>
              ))}
            </DropdownButton>
          </h2>
          {alertsDiv}
        </PfHeader>
        <div style={{ position: 'relative' }}>
          <SummaryPanel />
          <CytoscapeToolbar graphType={this.clickGraphType} />
          <CytoscapeLayout namespace={this.state.graphNamespace} layout={this.state.layout} />
        </div>
      </PfContainerNavVertical>
    );
  }
}

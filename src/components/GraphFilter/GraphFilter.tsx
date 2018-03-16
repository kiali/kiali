import * as React from 'react';
import { ButtonGroup, DropdownButton, MenuItem, Toolbar } from 'patternfly-react';
import { ButtonToolbar } from 'react-bootstrap';
import { GraphFilterProps, GraphFilterState } from '../../types/GraphFilter';
import * as API from '../../services/Api';
import { DagreGraph } from '../../components/CytoscapeLayout/graphs/DagreGraph';
import { ColaGraph } from '../../components/CytoscapeLayout/graphs/ColaGraph';
import { CoseGraph } from '../../components/CytoscapeLayout/graphs/CoseGraph';
import { BreadthFirstGraph } from '../../components/CytoscapeLayout/graphs/BreadthFirstGraph';
import { IntervalButtonGroup } from './IntervalButtonGroup';
import { LayoutButtonGroup } from './LayoutButtonGroup';
import { KlayGraph } from '../CytoscapeLayout/graphs/KlayGraph';

export namespace GraphFilters {
  let graphInterval: string = '30s';
  let graphLayout: any = DagreGraph.getLayout();
  let graphNamespace: string = 'istio-system';

  export const getGraphInterval = () => {
    return graphInterval;
  };

  export const getGraphLayout = () => {
    return graphLayout;
  };

  export const getGraphLayoutName = () => {
    return graphLayout.name;
  };

  export const getGraphNamespace = () => {
    return graphNamespace;
  };

  export const setGraphInterval = (value: string) => {
    graphInterval = value;
  };

  export const setGraphLayout = (value: string) => {
    if (value === 'breadthfirst') {
      graphLayout = BreadthFirstGraph.getLayout();
    } else if (value === 'cola') {
      graphLayout = ColaGraph.getLayout();
    } else if (value === 'dagre') {
      graphLayout = DagreGraph.getLayout();
    } else if (value === 'cose-bilkent') {
      graphLayout = CoseGraph.getLayout();
    } else if (value === 'klay') {
      graphLayout = KlayGraph.getLayout();
    } else {
      console.error('invalid graphLayout: ' + value);
    }
  };

  export const setGraphNamespace = (value: string) => {
    graphNamespace = value;
  };
}

export class GraphFilter extends React.Component<GraphFilterProps, GraphFilterState> {
  constructor(props: GraphFilterProps) {
    super(props);

    this.setNamespaces = this.setNamespaces.bind(this);
    this.updateInterval = this.updateInterval.bind(this);
    this.updateLayout = this.updateLayout.bind(this);
    this.updateNamespace = this.updateNamespace.bind(this);

    this.state = {
      graphInterval: GraphFilters.getGraphInterval(),
      graphLayout: GraphFilters.getGraphLayout(),
      graphNamespace: GraphFilters.getGraphNamespace(),
      availableNamespaces: []
    };
  }

  componentDidMount() {
    API.GetNamespaces()
      .then(this.setNamespaces)
      .catch(error => {
        this.props.onError(error);
      });
  }

  setNamespaces(response: any) {
    this.setState({ availableNamespaces: response['data'] });
  }

  updateInterval(value: string) {
    GraphFilters.setGraphInterval(value);
    this.setState({ graphInterval: GraphFilters.getGraphInterval() });
    this.props.onFilterChange();
  }

  updateLayout(value: string) {
    GraphFilters.setGraphLayout(value);
    this.setState({ graphLayout: GraphFilters.getGraphLayout() });
    this.props.onFilterChange();
  }

  updateNamespace(selected: string) {
    GraphFilters.setGraphNamespace(selected);
    this.setState({ graphNamespace: GraphFilters.getGraphNamespace() });
    this.props.onFilterChange();
  }

  render() {
    return (
      <div>
        <ButtonToolbar>
          <ButtonGroup>
            <DropdownButton id="namespace-selector" title={this.state.graphNamespace} onSelect={this.updateNamespace}>
              {this.state.availableNamespaces.map(ns => (
                <MenuItem key={ns.name} active={ns.name === this.state.graphNamespace} eventKey={ns.name}>
                  {ns.name}
                </MenuItem>
              ))}
            </DropdownButton>
          </ButtonGroup>
          <IntervalButtonGroup onClick={this.updateInterval} initialInterval={GraphFilters.getGraphInterval()} />
          <LayoutButtonGroup onClick={this.updateLayout} initialLayout={GraphFilters.getGraphLayoutName()} />
        </ButtonToolbar>
        <Toolbar />
      </div>
    );
  }
}

export default GraphFilter;

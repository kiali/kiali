import * as React from 'react';
import { ButtonGroup, DropdownButton, MenuItem, Toolbar } from 'patternfly-react';
import { ButtonToolbar } from 'react-bootstrap';
import { GraphFilterProps, GraphFilterState } from '../../types/GraphFilter';
import * as API from '../../services/Api';
import { DagreGraph } from '../../components/CytoscapeLayout/graphs/DagreGraph';
import { ColaGraph } from '../../components/CytoscapeLayout/graphs/ColaGraph';
import { CoseGraph } from '../../components/CytoscapeLayout/graphs/CoseGraph';
import { BreadthFirstGraph } from '../../components/CytoscapeLayout/graphs/BreadthFirstGraph';
import { DurationButtonGroup } from './DurationButtonGroup';
import { LayoutButtonGroup } from './LayoutButtonGroup';
import { KlayGraph } from '../CytoscapeLayout/graphs/KlayGraph';

export namespace GraphFilters {
  let graphDuration: string = '600';
  let graphLayout: any = DagreGraph.getLayout();
  let graphNamespace: string = 'istio-system';

  export const getGraphDuration = () => {
    return graphDuration;
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

  export const setGraphDuration = (value: string) => {
    graphDuration = value;
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
    this.updateDuration = this.updateDuration.bind(this);
    this.updateLayout = this.updateLayout.bind(this);
    this.updateNamespace = this.updateNamespace.bind(this);

    this.state = {
      graphDuration: GraphFilters.getGraphDuration(),
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

  updateDuration(value: string) {
    GraphFilters.setGraphDuration(value);
    this.setState({ graphDuration: GraphFilters.getGraphDuration() });
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
          <DurationButtonGroup onClick={this.updateDuration} initialDuration={GraphFilters.getGraphDuration()} />
          <LayoutButtonGroup onClick={this.updateLayout} initialLayout={GraphFilters.getGraphLayoutName()} />
        </ButtonToolbar>
        <Toolbar />
      </div>
    );
  }
}

export default GraphFilter;

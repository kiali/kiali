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
  const graphQueryOptionsPerDuration = {
    '60': { step: 2, rateInterval: '1m' }, // 1m - 60/2=30 buckets which is 1 datapoint per 2s
    '600': { step: 20, rateInterval: '1m' }, // 10m - 600/20=30 buckets which is 1 datapoint per 20s
    '1800': { step: 60, rateInterval: '1m' }, // 30m - 1800/60=30 buckets which is 1 datapoint per 1m
    '3600': { step: 120, rateInterval: '1m' }, // 1h - 3600/120=30 buckets which is 1 datapoint per 2m
    '14400': { step: 480, rateInterval: '1m' }, // 4h - 14400/480=30 buckets which is 1 datapoint per 8m
    '28800': { step: 960, rateInterval: '1m' }, // 8h - 28800/960=30 buckets which is 1 datapoint per 16m
    '86400': { step: 2880, rateInterval: '1m' }, // 1d - 86400/2880=30 buckets which is 1 datapoint per 48m
    '604800': { step: 20160, rateInterval: '1m' }, // 7d - 604800/20160=30 buckets which is 1 datapoint per 5.6h
    '2592000': { step: 86400, rateInterval: '1m' } // 30d - 2592000/86400=30 buckets which is 1 datapoint per 1d
  };

  let graphDuration: string = '600';
  let graphStep: number = 100;
  let graphRateInterval: string = '1m';
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

  export const getGraphStep = () => {
    return graphStep;
  };

  export const getGraphRateInterval = () => {
    return graphRateInterval;
  };

  export const setGraphDuration = (value: string) => {
    graphDuration = value;
    graphStep = graphQueryOptionsPerDuration[value].step;
    graphRateInterval = graphQueryOptionsPerDuration[value].rateInterval;
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

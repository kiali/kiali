import { Select, SelectGroup, SelectOption, SelectVariant } from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../app/History';
import { GraphFilterState, KialiAppState } from '../../store/Store';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { GraphFilterActions } from '../../actions/GraphFilterActions';
import { GraphType } from '../../types/Graph';

type ReduxProps = Omit<GraphFilterState, 'findValue' | 'hideValue' | 'showLegend' | 'showFindHelp'> & {
  // Dispatch methods
  toggleCompressOnHide(): void;
  toggleGraphCircuitBreakers(): void;
  toggleGraphMissingSidecars(): void;
  toggleGraphNodeLabels(): void;
  toggleGraphSecurity(): void;
  toggleGraphVirtualServices(): void;
  toggleServiceNodes(): void;
  toggleTrafficAnimation(): void;
  toggleUnusedNodes(): void;
};

type GraphSettingsProps = ReduxProps;

type GraphSettingsState = { isOpen: boolean };

interface VisibilityLayersType {
  id: string;
  disabled?: boolean;
  labelText: string;
  value: boolean;
  onChange: () => void;
}

class GraphSettings extends React.PureComponent<GraphSettingsProps, GraphSettingsState> {
  constructor(props: GraphSettingsProps) {
    super(props);
    this.state = {
      isOpen: false
    };

    // Let URL override current redux state at construction time. Update URL with unset params.
    const urlInjectServiceNodes = HistoryManager.getBooleanParam(URLParam.GRAPH_SERVICE_NODES);
    if (urlInjectServiceNodes !== undefined) {
      if (urlInjectServiceNodes !== props.showServiceNodes) {
        props.toggleServiceNodes();
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_SERVICE_NODES, String(this.props.showServiceNodes));
    }
  }

  private onToggle = isOpen => {
    this.setState({
      isOpen
    });
  };

  componentDidUpdate(_prevProps: GraphSettingsProps) {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParam.GRAPH_SERVICE_NODES, String(this.props.showServiceNodes));
  }

  render() {
    // map our attributes from redux
    const {
      compressOnHide,
      showCircuitBreakers,
      showMissingSidecars,
      showNodeLabels,
      showSecurity,
      showServiceNodes,
      showTrafficAnimation,
      showUnusedNodes,
      showVirtualServices
    } = this.props;

    // map our dispatchers for redux
    const {
      toggleCompressOnHide,
      toggleGraphCircuitBreakers,
      toggleGraphMissingSidecars,
      toggleGraphNodeLabels,
      toggleGraphSecurity,
      toggleGraphVirtualServices,
      toggleServiceNodes,
      toggleTrafficAnimation,
      toggleUnusedNodes
    } = this.props;

    const visibilityLayers: VisibilityLayersType[] = [
      {
        id: 'filterHide',
        labelText: 'Compress Hidden',
        value: compressOnHide,
        onChange: toggleCompressOnHide
      },
      {
        id: 'filterNodes',
        labelText: 'Node Names',
        value: showNodeLabels,
        onChange: toggleGraphNodeLabels
      },
      {
        id: 'filterServiceNodes',
        disabled: this.props.graphType === GraphType.SERVICE,
        labelText: 'Service Nodes',
        value: showServiceNodes,
        onChange: toggleServiceNodes
      },
      {
        id: 'filterTrafficAnimation',
        labelText: 'Traffic Animation',
        value: showTrafficAnimation,
        onChange: toggleTrafficAnimation
      },
      {
        id: 'filterUnusedNodes',
        labelText: 'Unused Nodes',
        value: showUnusedNodes,
        onChange: toggleUnusedNodes
      }
    ];

    const badges: VisibilityLayersType[] = [
      {
        id: 'filterCB',
        labelText: 'Circuit Breakers',
        value: showCircuitBreakers,
        onChange: toggleGraphCircuitBreakers
      },
      {
        id: 'filterSidecars',
        labelText: 'Missing Sidecars',
        value: showMissingSidecars,
        onChange: toggleGraphMissingSidecars
      },
      {
        id: 'filterVS',
        labelText: 'Virtual Services',
        value: showVirtualServices,
        onChange: toggleGraphVirtualServices
      },
      {
        id: 'filterSecurity',
        labelText: 'Security',
        value: showSecurity,
        onChange: toggleGraphSecurity
      }
    ];

    const { isOpen } = this.state;

    const selection = visibilityLayers
      .filter((item: VisibilityLayersType) => item.value)
      .concat(badges.filter((item: VisibilityLayersType) => item.value))
      .map((item: VisibilityLayersType) => item.labelText);

    return (
      <Select
        placeholderText="Display"
        onToggle={this.onToggle}
        onSelect={() => undefined}
        isExpanded={isOpen}
        variant={SelectVariant.checkbox}
        isGrouped={true}
        selections={selection}
      >
        <SelectGroup label="" key="visibilityLayers">
          {visibilityLayers.map((item: VisibilityLayersType) => (
            <SelectOption
              isChecked={item.value}
              isDisabled={item.disabled}
              key={item.id}
              value={item.labelText}
              onClick={item.onChange}
            />
          ))}
        </SelectGroup>
        <SelectGroup label="Badges" key="badges">
          {badges.map((item: VisibilityLayersType) => (
            <SelectOption isChecked={item.value} key={item.id} value={item.labelText} onClick={item.onChange} />
          ))}
        </SelectGroup>
      </Select>
    );
  }
}

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  compressOnHide: state.graph.filterState.compressOnHide,
  showCircuitBreakers: state.graph.filterState.showCircuitBreakers,
  showMissingSidecars: state.graph.filterState.showMissingSidecars,
  showNodeLabels: state.graph.filterState.showNodeLabels,
  showSecurity: state.graph.filterState.showSecurity,
  showServiceNodes: state.graph.filterState.showServiceNodes,
  showTrafficAnimation: state.graph.filterState.showTrafficAnimation,
  showUnusedNodes: state.graph.filterState.showUnusedNodes,
  showVirtualServices: state.graph.filterState.showVirtualServices
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    toggleCompressOnHide: bindActionCreators(GraphFilterActions.toggleCompressOnHide, dispatch),
    toggleGraphCircuitBreakers: bindActionCreators(GraphFilterActions.toggleGraphCircuitBreakers, dispatch),
    toggleGraphMissingSidecars: bindActionCreators(GraphFilterActions.toggleGraphMissingSidecars, dispatch),
    toggleGraphNodeLabels: bindActionCreators(GraphFilterActions.toggleGraphNodeLabel, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphFilterActions.toggleGraphSecurity, dispatch),
    toggleGraphVirtualServices: bindActionCreators(GraphFilterActions.toggleGraphVirtualServices, dispatch),
    toggleServiceNodes: bindActionCreators(GraphFilterActions.toggleServiceNodes, dispatch),
    toggleTrafficAnimation: bindActionCreators(GraphFilterActions.toggleTrafficAnimation, dispatch),
    toggleUnusedNodes: bindActionCreators(GraphFilterActions.toggleUnusedNodes, dispatch)
  };
};

// hook up to Redux for our State to be mapped to props
const GraphSettingsContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphSettings);
export default GraphSettingsContainer;

import { Select, SelectGroup, SelectOption, SelectVariant } from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../../app/History';
import { GraphToolbarState, KialiAppState } from '../../../store/Store';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphType } from '../../../types/Graph';
import { KialiAppAction } from 'actions/KialiAppAction';

type ReduxProps = Omit<GraphToolbarState, 'findValue' | 'hideValue' | 'showLegend' | 'showFindHelp'> & {
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
        <SelectGroup label="Show" key="visibilityLayers">
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
        <SelectGroup label="Show Badges" key="badges">
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
  compressOnHide: state.graph.toolbarState.compressOnHide,
  showCircuitBreakers: state.graph.toolbarState.showCircuitBreakers,
  showMissingSidecars: state.graph.toolbarState.showMissingSidecars,
  showNodeLabels: state.graph.toolbarState.showNodeLabels,
  showSecurity: state.graph.toolbarState.showSecurity,
  showServiceNodes: state.graph.toolbarState.showServiceNodes,
  showTrafficAnimation: state.graph.toolbarState.showTrafficAnimation,
  showUnusedNodes: state.graph.toolbarState.showUnusedNodes,
  showVirtualServices: state.graph.toolbarState.showVirtualServices
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    toggleCompressOnHide: bindActionCreators(GraphToolbarActions.toggleCompressOnHide, dispatch),
    toggleGraphCircuitBreakers: bindActionCreators(GraphToolbarActions.toggleGraphCircuitBreakers, dispatch),
    toggleGraphMissingSidecars: bindActionCreators(GraphToolbarActions.toggleGraphMissingSidecars, dispatch),
    toggleGraphNodeLabels: bindActionCreators(GraphToolbarActions.toggleGraphNodeLabel, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphToolbarActions.toggleGraphSecurity, dispatch),
    toggleGraphVirtualServices: bindActionCreators(GraphToolbarActions.toggleGraphVirtualServices, dispatch),
    toggleServiceNodes: bindActionCreators(GraphToolbarActions.toggleServiceNodes, dispatch),
    toggleTrafficAnimation: bindActionCreators(GraphToolbarActions.toggleTrafficAnimation, dispatch),
    toggleUnusedNodes: bindActionCreators(GraphToolbarActions.toggleUnusedNodes, dispatch)
  };
};

// hook up to Redux for our State to be mapped to props
const GraphSettingsContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphSettings);
export default GraphSettingsContainer;

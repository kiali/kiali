import { Dropdown, DropdownToggle } from '@patternfly/react-core';
import { style } from 'typestyle';
import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../app/History';
import { GraphFilterState, KialiAppState } from '../../store/Store';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { GraphFilterActions } from '../../actions/GraphFilterActions';
import { GraphType } from '../../types/Graph';
import { PfColors } from '../Pf/PfColors';

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

    const checkboxStyle = style({ marginLeft: 10 });
    const disabledCheckboxStyle = style({ marginLeft: 10, color: PfColors.Gray });

    const displaySettingItems = visibilityLayers.map((item: VisibilityLayersType) => (
      <div id={item.id} key={item.id}>
        <label>
          <input type="checkbox" checked={item.value} onChange={() => item.onChange()} disabled={item.disabled} />
          <span className={item.disabled ? disabledCheckboxStyle : checkboxStyle}>{item.labelText}</span>
        </label>
      </div>
    ));

    const badgeItems = badges.map((item: VisibilityLayersType) => (
      <div id={item.id} key={item.id}>
        <label>
          <input type="checkbox" checked={item.value} onChange={() => item.onChange()} />
          <span className={checkboxStyle}>{item.labelText}</span>
        </label>
      </div>
    ));

    const spacerStyle = style({
      height: '1em'
    });

    const graphSettingsContent = (
      // TODO: Remove the class="pf-c-dropdown__menu-item" attribute which is fixing a sizing issue in PF.
      // https://github.com/patternfly/patternfly-react/issues/3156
      <div style={{ paddingLeft: '10px', backgroundColor: PfColors.White }} className="pf-c-dropdown__menu-item">
        {displaySettingItems}
        <div className={spacerStyle} />
        <label>Badges:</label>
        {badgeItems}
      </div>
    );

    const { isOpen } = this.state;

    return (
      <Dropdown toggle={<DropdownToggle onToggle={this.onToggle}>Display</DropdownToggle>} isOpen={isOpen}>
        {graphSettingsContent}
      </Dropdown>
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

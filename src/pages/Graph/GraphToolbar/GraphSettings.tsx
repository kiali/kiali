import { Radio, Dropdown, DropdownToggle, Checkbox, Tooltip, TooltipPosition } from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../../app/History';
import { GraphToolbarState, KialiAppState } from '../../../store/Store';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphType, EdgeLabelMode } from '../../../types/Graph';
import { KialiAppAction } from 'actions/KialiAppAction';
import * as _ from 'lodash';
import { edgeLabelModeSelector } from 'store/Selectors';
import {
  BoundingClientAwareComponent,
  PropertyType
} from 'components/BoundingClientAwareComponent/BoundingClientAwareComponent';
import { style } from 'typestyle';
import { PfColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';

type ReduxProps = {
  setEdgeLabelMode: (edgeLabelMode: EdgeLabelMode) => void;
  toggleCompressOnHide(): void;
  toggleGraphCircuitBreakers(): void;
  toggleGraphMissingSidecars(): void;
  toggleGraphNodeLabels(): void;
  toggleGraphSecurity(): void;
  toggleGraphVirtualServices(): void;
  toggleOperationNodes(): void;
  toggleServiceNodes(): void;
  toggleTrafficAnimation(): void;
  toggleUnusedNodes(): void;
};

type GraphSettingsProps = ReduxProps &
  Omit<GraphToolbarState, 'findValue' | 'hideValue' | 'showLegend' | 'showFindHelp'>;

type GraphSettingsState = { isOpen: boolean };

interface DisplayOptionType {
  id: string;
  disabled?: boolean;
  labelText: string;
  isChecked: boolean;
  onChange?: () => void;
  tooltip?: React.ReactNode;
}

const marginBottom = 20;

const containerStyle = style({
  overflow: 'auto'
});

// this emulates Select component .pf-c-select__menu
const menuStyle = style({
  fontSize: '14px'
});

// this emulates Select component .pf-c-select__menu-group-title but with less bottom padding to conserve space
const titleStyle = style({
  padding: '8px 16px 2px 16px',
  fontWeight: 700,
  color: PfColors.Black600
});

// this emulates Select component .pf-c-select__menu-item but with less vertical padding to conserve space
const itemStyle = (hasInfo: boolean) =>
  style({
    alignItems: 'center',
    whiteSpace: 'nowrap',
    margin: 0,
    padding: hasInfo ? '6px 0px 6px 16px' : '6px 16px'
  });

const infoStyle = style({
  margin: '0px 16px 2px 4px'
});

class GraphSettings extends React.PureComponent<GraphSettingsProps, GraphSettingsState> {
  constructor(props: GraphSettingsProps) {
    super(props);
    this.state = {
      isOpen: false
    };

    // Let URL override current redux state at construction time. Update URL with unset params.
    const urlShowOperationNodes = HistoryManager.getBooleanParam(URLParam.OPERATION_NODES);
    if (urlShowOperationNodes !== undefined) {
      if (urlShowOperationNodes !== props.showOperationNodes) {
        props.toggleOperationNodes();
      }
    } else {
      HistoryManager.setParam(URLParam.OPERATION_NODES, String(this.props.showOperationNodes));
    }
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
    HistoryManager.setParam(URLParam.OPERATION_NODES, String(this.props.showOperationNodes));
    HistoryManager.setParam(URLParam.GRAPH_SERVICE_NODES, String(this.props.showServiceNodes));
  }

  render() {
    const { isOpen } = this.state;
    return (
      <Dropdown
        toggle={
          <DropdownToggle id={'display-settings'} onToggle={this.onToggle}>
            Display
          </DropdownToggle>
        }
        isOpen={isOpen}
      >
        {this.getPopoverContent()}
      </Dropdown>
    );
  }

  private getPopoverContent() {
    // map our attributes from redux
    const {
      compressOnHide,
      edgeLabelMode,
      showCircuitBreakers,
      showMissingSidecars,
      showNodeLabels,
      showOperationNodes,
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
      toggleOperationNodes,
      toggleServiceNodes,
      toggleTrafficAnimation,
      toggleUnusedNodes
    } = this.props;

    const edgeLabelOptions: DisplayOptionType[] = [
      {
        id: EdgeLabelMode.NONE,
        labelText: _.startCase(EdgeLabelMode.NONE),
        isChecked: edgeLabelMode === EdgeLabelMode.NONE
      },
      {
        id: EdgeLabelMode.REQUESTS_PER_SECOND,
        labelText: _.startCase(EdgeLabelMode.REQUESTS_PER_SECOND),
        isChecked: edgeLabelMode === EdgeLabelMode.REQUESTS_PER_SECOND
      },
      {
        id: EdgeLabelMode.REQUESTS_PERCENTAGE,
        labelText: _.startCase(EdgeLabelMode.REQUESTS_PERCENTAGE),
        isChecked: edgeLabelMode === EdgeLabelMode.REQUESTS_PERCENTAGE
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE,
        labelText: _.startCase(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE),
        isChecked: edgeLabelMode === EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>Displays the 95th Percentile.</div>
            <div>
              To see other response time percentiles select the desired edge and see the side panel. The following edges
              do not offer a response time label but the information is availabe in the side panel:
            </div>
            <div>- edges into service nodes</div>
            <div>- edges into or out of operation nodes.</div>
          </div>
        )
      }
    ];

    const visibilityOptions: DisplayOptionType[] = [
      {
        id: 'filterHide',
        labelText: 'Compress Hidden',
        isChecked: compressOnHide,
        onChange: toggleCompressOnHide,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            When enabled the graph is compressed after graph-hide removes matching elements. Otherwise the graph
            maintains the space consumed by the hidden elements.
          </div>
        )
      },
      {
        id: 'filterNodes',
        labelText: 'Node Names',
        isChecked: showNodeLabels,
        onChange: toggleGraphNodeLabels
      },
      {
        id: 'filterOperationNodes',
        disabled: this.props.graphType === GraphType.SERVICE,
        labelText: 'Operation Nodes',
        isChecked: showOperationNodes,
        onChange: toggleOperationNodes,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              When both operation and service nodes are enabled then the operation is displayed specific to each service
              to which it applies, and therefore may be duplicated for different services. When enabled independently
              each operation will have a single node representing the total traffic for that operation.
            </div>
            <div>- Operations with no traffic are ignored.</div>
            <div>- This is not applicable to Service graphs.</div>
            <div>
              - Operation nodes require additional "Request Classification" Istio configuration for workloads in the
              selected namespaces.
            </div>
          </div>
        )
      },
      {
        id: 'filterServiceNodes',
        disabled: this.props.graphType === GraphType.SERVICE,
        labelText: 'Service Nodes',
        isChecked: showServiceNodes,
        onChange: toggleServiceNodes
      },
      {
        id: 'filterTrafficAnimation',
        labelText: 'Traffic Animation',
        isChecked: showTrafficAnimation,
        onChange: toggleTrafficAnimation
      },
      {
        id: 'filterUnusedNodes',
        labelText: 'Unused Nodes',
        isChecked: showUnusedNodes,
        onChange: toggleUnusedNodes
      }
    ];

    const badgeOptions: DisplayOptionType[] = [
      {
        id: 'filterCB',
        labelText: 'Circuit Breakers',
        isChecked: showCircuitBreakers,
        onChange: toggleGraphCircuitBreakers
      },
      {
        id: 'filterSidecars',
        labelText: 'Missing Sidecars',
        isChecked: showMissingSidecars,
        onChange: toggleGraphMissingSidecars
      },
      {
        id: 'filterVS',
        labelText: 'Virtual Services',
        isChecked: showVirtualServices,
        onChange: toggleGraphVirtualServices
      },
      {
        id: 'filterSecurity',
        labelText: 'Security',
        isChecked: showSecurity,
        onChange: toggleGraphSecurity,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              Show closed or open lock icons on edges with traffic that differs from the global mTLS policy. The
              percentage of mTLS traffic can be seen in the side-panel when selecting the edge. Note that the global
              masthead will show a lock icon when global mTLS is enabled. The side-panel will also display source and
              destination principals, if available.
            </div>
          </div>
        )
      }
    ];

    return (
      <BoundingClientAwareComponent
        className={containerStyle}
        maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
      >
        <div id="graph-display-menu" className={menuStyle}>
          <div className={titleStyle}>Show Edge Labels</div>
          {edgeLabelOptions.map((item: DisplayOptionType) => (
            <div key={item.id} style={{ display: 'inline-block', cursor: 'not-allowed' }}>
              <label key={item.id} className={itemStyle(!!item.tooltip)}>
                <Radio
                  id={item.id}
                  name="edgeLabels"
                  isChecked={item.isChecked}
                  label={item.labelText}
                  onChange={this.setEdgeLabelMode}
                  value={item.id}
                />
              </label>
              {!!item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.top} content={item.tooltip}>
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
            </div>
          ))}
          <div className={titleStyle}>Show</div>
          {visibilityOptions.map((item: DisplayOptionType) => (
            <div key={item.id} style={{ display: 'inline-block', cursor: 'not-allowed' }}>
              <label key={item.id} className={itemStyle(!!item.tooltip)}>
                <Checkbox
                  id={item.id}
                  isChecked={item.isChecked}
                  label={item.labelText}
                  onChange={item.onChange}
                  isDisabled={item.disabled}
                />
              </label>
              {!!item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.top} content={item.tooltip}>
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
            </div>
          ))}
          <div className={titleStyle}>Show Badges</div>
          {badgeOptions.map((item: DisplayOptionType) => (
            <div key={item.id} style={{ display: 'inline-block', cursor: 'not-allowed' }}>
              <label key={item.id} className={itemStyle(!!item.tooltip)}>
                <Checkbox id={item.id} isChecked={item.isChecked} label={item.labelText} onChange={item.onChange} />
              </label>
              {!!item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.top} content={item.tooltip}>
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </BoundingClientAwareComponent>
    );
  }

  private setEdgeLabelMode = (_, event) => {
    const mode = event.target.value as EdgeLabelMode;
    if (this.props.edgeLabelMode !== mode) {
      this.props.setEdgeLabelMode(mode);
    }
  };
}

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  compressOnHide: state.graph.toolbarState.compressOnHide,
  edgeLabelMode: edgeLabelModeSelector(state),
  showCircuitBreakers: state.graph.toolbarState.showCircuitBreakers,
  showMissingSidecars: state.graph.toolbarState.showMissingSidecars,
  showNodeLabels: state.graph.toolbarState.showNodeLabels,
  showOperationNodes: state.graph.toolbarState.showOperationNodes,
  showSecurity: state.graph.toolbarState.showSecurity,
  showServiceNodes: state.graph.toolbarState.showServiceNodes,
  showTrafficAnimation: state.graph.toolbarState.showTrafficAnimation,
  showUnusedNodes: state.graph.toolbarState.showUnusedNodes,
  showVirtualServices: state.graph.toolbarState.showVirtualServices
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setEdgeLabelMode: bindActionCreators(GraphToolbarActions.setEdgelLabelMode, dispatch),
    toggleCompressOnHide: bindActionCreators(GraphToolbarActions.toggleCompressOnHide, dispatch),
    toggleGraphCircuitBreakers: bindActionCreators(GraphToolbarActions.toggleGraphCircuitBreakers, dispatch),
    toggleGraphMissingSidecars: bindActionCreators(GraphToolbarActions.toggleGraphMissingSidecars, dispatch),
    toggleGraphNodeLabels: bindActionCreators(GraphToolbarActions.toggleGraphNodeLabel, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphToolbarActions.toggleGraphSecurity, dispatch),
    toggleGraphVirtualServices: bindActionCreators(GraphToolbarActions.toggleGraphVirtualServices, dispatch),
    toggleOperationNodes: bindActionCreators(GraphToolbarActions.toggleOperationNodes, dispatch),
    toggleServiceNodes: bindActionCreators(GraphToolbarActions.toggleServiceNodes, dispatch),
    toggleTrafficAnimation: bindActionCreators(GraphToolbarActions.toggleTrafficAnimation, dispatch),
    toggleUnusedNodes: bindActionCreators(GraphToolbarActions.toggleUnusedNodes, dispatch)
  };
};

// hook up to Redux for our State to be mapped to props
const GraphSettingsContainer = connect(mapStateToProps, mapDispatchToProps)(GraphSettings);
export default GraphSettingsContainer;

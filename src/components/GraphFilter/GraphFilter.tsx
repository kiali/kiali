import * as React from 'react';
import { style } from 'typestyle';
import { Toolbar, FormGroup, Button } from 'patternfly-react';
import * as _ from 'lodash';

import { EdgeLabelMode } from '../../types/GraphFilter';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import NamespaceDropdownContainer from '../../containers/NamespaceDropdownContainer';
import { GraphParamsType, GraphType } from '../../types/Graph';
import GraphSettingsContainer from '../../containers/GraphSettingsContainer';
import { GraphRefreshContainerDefaultRefreshIntervals } from '../../containers/GraphRefreshContainer';
import { store } from '../../store/ConfigStore';

export interface GraphFilterProps extends GraphParamsType {
  disabled: boolean;
  onNamespaceReturn: () => void;
  onGraphTypeChange: (newType: GraphType) => void;
  onEdgeLabelModeChange: (newEdgeLabelMode: EdgeLabelMode) => void;
  onRefresh: () => void;
}

type GraphFilterPropsReadOnly = Readonly<GraphFilterProps>;

const zeroPaddingLeft = style({
  marginLeft: '20px',
  paddingLeft: '0px'
});

const namespaceStyle = style({
  marginLeft: '-40px',
  marginRight: '5px'
});

export default class GraphFilter extends React.PureComponent<GraphFilterPropsReadOnly> {
  // GraphFilter should be minimal and used for assembling those filtering components.

  /**
   *  Key-value pair object representation of GraphType enum.  Values are human-readable versions of enum keys.
   *
   *  Example:  GraphType => {'APP': 'App', 'VERSIONED_APP': 'VersionedApp'}
   */
  static readonly GRAPH_TYPES = _.mapValues(GraphType, val => _.capitalize(_.startCase(val)));

  /**
   *  Key-value pair object representation of EdgeLabelMode
   *
   *  Example:  EdgeLabelMode =>{'TRAFFIC_RATE_PER_SECOND': 'TrafficRatePerSecond'}
   */
  static readonly EDGE_LABEL_MODES = _.mapValues(_.omitBy(EdgeLabelMode, _.isFunction), val =>
    _.capitalize(_.startCase(val as EdgeLabelMode))
  );

  constructor(props: GraphFilterProps) {
    super(props);
  }

  handleRefresh = () => {
    this.props.onRefresh();
  };

  render() {
    const graphTypeKey: string = _.findKey(GraphType, val => val === this.props.graphType)!;
    const edgeLabelModeKey: string = _.findKey(EdgeLabelMode, val => val === this.props.edgeLabelMode)!;

    return (
      <>
        <Toolbar>
          <FormGroup className={zeroPaddingLeft}>
            {this.props.node ? (
              <Button className={namespaceStyle} onClick={this.props.onNamespaceReturn}>
                Back To Namespace
              </Button>
            ) : (
              <label className={namespaceStyle}>Namespace</label>
            )}
            <NamespaceDropdownContainer disabled={this.props.node || this.props.disabled} />
          </FormGroup>
          <FormGroup className={zeroPaddingLeft}>
            <GraphSettingsContainer {...this.props} />
          </FormGroup>
          <ToolbarDropdown
            id={'graph_filter_edge_labels'}
            disabled={false}
            handleSelect={this.updateEdgeLabelMode}
            value={edgeLabelModeKey}
            label="Edge Labels"
            options={GraphFilter.EDGE_LABEL_MODES}
          />
          <ToolbarDropdown
            id={'graph_filter_view_type'}
            disabled={this.props.node !== undefined || this.props.disabled}
            handleSelect={this.updateGraphType}
            nameDropdown={'Graph Type'}
            value={graphTypeKey}
            label={GraphFilter.GRAPH_TYPES[graphTypeKey]}
            options={GraphFilter.GRAPH_TYPES}
          />
          <Toolbar.RightContent>
            <GraphRefreshContainerDefaultRefreshIntervals
              id="graph_refresh_container"
              disabled={this.props.disabled}
              handleRefresh={this.handleRefresh}
              duration={store.getState().userSettings.duration}
            />
          </Toolbar.RightContent>
        </Toolbar>
      </>
    );
  }

  private updateGraphType = (type: string) => {
    const graphType: GraphType = GraphType[type] as GraphType;
    if (this.props.graphType !== graphType) {
      this.props.onGraphTypeChange(graphType);
    }
  };

  private updateEdgeLabelMode = (edgeMode: string) => {
    const mode: EdgeLabelMode = EdgeLabelMode[edgeMode] as EdgeLabelMode;
    if (this.props.edgeLabelMode !== mode) {
      this.props.onEdgeLabelModeChange(mode);
    }
  };
}

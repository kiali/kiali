import * as React from 'react';
import { style } from 'typestyle';
import { Toolbar, FormGroup, Button } from 'patternfly-react';
import * as _ from 'lodash';

import { Duration, EdgeLabelMode } from '../../types/GraphFilter';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import NamespaceDropdownContainer from '../../containers/NamespaceDropdownContainer';
import { GraphParamsType, GraphType } from '../../types/Graph';
import Namespace from '../../types/Namespace';
import GraphRefreshContainer from '../../containers/GraphRefreshContainer';
import GraphSettingsContainer from '../../containers/GraphSettingsContainer';

export interface GraphFilterProps extends GraphParamsType {
  disabled: boolean;
  onDurationChange: (newDuration: Duration) => void;
  onNamespaceChange: (newValue: Namespace) => void;
  onNamespaceReturn: () => void;
  onGraphTypeChange: (newType: GraphType) => void;
  onEdgeLabelModeChange: (newEdgeLabelMode: EdgeLabelMode) => void;
  onRefresh: () => void;
}

const zeroPaddingLeft = style({
  marginLeft: '20px',
  paddingLeft: '0px'
});

const namespaceStyle = style({
  marginLeft: '-40px',
  marginRight: '5px'
});

export default class GraphFilter extends React.PureComponent<GraphFilterProps> {
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

  updateDuration = (value: number) => {
    if (this.props.graphDuration.value !== value) {
      this.props.onDurationChange({ value: value });
    }
  };

  handleRefresh = (e: any) => {
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
              <label className={namespaceStyle}>Namespace:</label>
            )}
            <NamespaceDropdownContainer
              disabled={this.props.node || this.props.disabled}
              activeNamespace={this.props.namespace}
              onSelect={this.props.onNamespaceChange}
            />
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
            <GraphRefreshContainer
              id="graph_refresh_container"
              disabled={this.props.disabled}
              handleRefresh={this.handleRefresh}
              graphDuration={this.props.graphDuration}
              onUpdateGraphDuration={this.updateDuration}
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

import * as React from 'react';
import { style } from 'typestyle';
import { Toolbar, FormGroup, Button } from 'patternfly-react';
import * as _ from 'lodash';

import { Duration } from '../../types/GraphFilter';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import NamespaceDropdownContainer from '../../containers/NamespaceDropdownContainer';
import { config } from '../../config';
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
  static readonly INTERVAL_DURATION = config().toolbar.intervalDuration;
  static readonly GRAPH_TYPES = _.mapValues(GraphType, val => _.capitalize(_.startCase(val)));

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
            id={'graph_filter_view_type'}
            disabled={this.props.node !== undefined || this.props.disabled}
            handleSelect={this.updateGraphType}
            nameDropdown={'Graph Type'}
            value={graphTypeKey}
            label={GraphFilter.GRAPH_TYPES[graphTypeKey]}
            options={GraphFilter.GRAPH_TYPES}
          />
          <span style={{ marginLeft: '1.5em' }}>
            <ToolbarDropdown
              id={'graph_filter_interval_duration'}
              disabled={this.props.disabled}
              handleSelect={this.updateDuration}
              nameDropdown={'Displaying'}
              value={this.props.graphDuration.value}
              label={String(GraphFilter.INTERVAL_DURATION[this.props.graphDuration.value])}
              options={GraphFilter.INTERVAL_DURATION}
            />
          </span>
          <Toolbar.RightContent>
            <GraphRefreshContainer id="graph_refresh_container" handleRefresh={this.handleRefresh} />
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
}

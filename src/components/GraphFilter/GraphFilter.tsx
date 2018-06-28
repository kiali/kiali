import * as React from 'react';
import { Toolbar, FormGroup } from 'patternfly-react';

import { Duration, EdgeLabelMode } from '../../types/GraphFilter';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import NamespaceDropdownContainer from '../../containers/NamespaceDropdownContainer';
import { config } from '../../config';
import { style } from 'typestyle';
import { GraphParamsType } from '../../types/Graph';
import Namespace from '../../types/Namespace';
import GraphRefreshContainer from '../../containers/GraphRefreshContainer';

import * as _ from 'lodash';
import GraphSettingsContainer from '../../containers/GraphSettingsContainer';

export interface GraphFilterProps extends GraphParamsType {
  disabled: boolean;
  onDurationChange: (newDuration: Duration) => void;
  onNamespaceChange: (newValue: Namespace) => void;
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
  static readonly GRAPH_LAYOUTS = config().toolbar.graphLayouts;
  static readonly EDGE_LABEL_MODES = EdgeLabelMode.getValues().reduce((map, edgeLabelMode) => {
    map[edgeLabelMode] = _.capitalize(_.startCase(edgeLabelMode));
    return map;
  }, {});

  constructor(props: GraphFilterProps) {
    super(props);
  }

  updateDuration = (value: number) => {
    if (this.props.graphDuration.value !== value) {
      this.props.onDurationChange({ value: value });
    }
  };

  updateNamespace = (selected: string) => {
    if (this.props.namespace.name !== selected) {
      this.props.onNamespaceChange({ name: selected });
    }
  };

  handleRefresh = (e: any) => {
    this.props.onRefresh();
  };

  render() {
    return (
      <>
        <Toolbar>
          <FormGroup className={zeroPaddingLeft}>
            <label className={namespaceStyle}>Namespace:</label>
            <NamespaceDropdownContainer
              disabled={this.props.disabled}
              activeNamespace={this.props.namespace}
              onSelect={this.props.onNamespaceChange}
            />
          </FormGroup>
          <FormGroup className={zeroPaddingLeft}>
            <GraphSettingsContainer {...this.props} />
          </FormGroup>
          <span style={{ marginLeft: '1.5em' }}>
            <ToolbarDropdown
              id={'graph_filter_interval_duration'}
              disabled={this.props.disabled}
              handleSelect={this.updateDuration}
              nameDropdown={'Displaying'}
              initialValue={this.props.graphDuration.value}
              initialLabel={String(GraphFilter.INTERVAL_DURATION[this.props.graphDuration.value])}
              options={GraphFilter.INTERVAL_DURATION}
            />
          </span>
          <GraphRefreshContainer id="refresh-button" handleRefresh={this.handleRefresh} />
        </Toolbar>
      </>
    );
  }
}

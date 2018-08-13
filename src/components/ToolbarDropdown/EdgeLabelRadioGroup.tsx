import * as React from 'react';
import PropTypes from 'prop-types';
import { style } from 'typestyle';
import * as _ from 'lodash';

import { GraphParamsType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';

const EDGE_LABEL_MODES = EdgeLabelMode.getValues().reduce((map, edgeLabelMode) => {
  map[edgeLabelMode] = _.capitalize(_.startCase(edgeLabelMode));
  return map;
}, {});

type EdgeLabelRadioGroupProps = {
  graphParams: GraphParamsType;
  onEdgeChanged: PropTypes.func;
};

export class EdgeLabelRadioGroup extends React.Component<EdgeLabelRadioGroupProps> {
  constructor(props: EdgeLabelRadioGroupProps) {
    super(props);
  }

  onEdgeChanged = (event: any) => {
    const selectedEdge = event.target.value;
    this.setState({
      edgeValue: selectedEdge
    });
    this.props.onEdgeChanged(event);
  };

  render() {
    const radioButtonStyle = style({ marginLeft: 5 });

    const edgeItems = Object.keys(EDGE_LABEL_MODES).map((edgeLabelModeKey: any) => (
      <div key={edgeLabelModeKey}>
        <label className={radioButtonStyle}>
          <input
            type="radio"
            name="edge-label-radio-group"
            value={edgeLabelModeKey}
            checked={edgeLabelModeKey === this.props.graphParams.edgeLabelMode}
            onChange={this.onEdgeChanged}
          />
          <span className={radioButtonStyle}>{EDGE_LABEL_MODES[edgeLabelModeKey]}</span>
        </label>
      </div>
    ));

    return (
      <>
        <div>
          <label>Edge Labels:</label>
        </div>
        {edgeItems}
      </>
    );
  }
}

export default EdgeLabelRadioGroup;

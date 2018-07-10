import * as React from 'react';
import PropTypes from 'prop-types';
import { style } from 'typestyle';

import GraphFilter from '../GraphFilter/GraphFilter';
import { GraphParamsType } from '../../types/Graph';

type EdgeLabelRadioGroupProps = {
  graphParams: GraphParamsType;
  onEdgeChanged: PropTypes.func;
};

type EdgeLabelRadioGroupState = {
  edgeValue?: string;
};

export class EdgeLabelRadioGroup extends React.Component<EdgeLabelRadioGroupProps, EdgeLabelRadioGroupState> {
  constructor(props: EdgeLabelRadioGroupProps) {
    super(props);
    this.state = {
      edgeValue: props.graphParams.edgeLabelMode
    };
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

    const edgeItems = Object.keys(GraphFilter.EDGE_LABEL_MODES).map((edgeLabelModeKey: any) => (
      <div key={edgeLabelModeKey}>
        <label className={radioButtonStyle}>
          <input
            type="radio"
            name="edge-label-radio-group"
            value={edgeLabelModeKey}
            checked={edgeLabelModeKey === this.state.edgeValue}
            onChange={this.onEdgeChanged}
          />
          <span className={radioButtonStyle}>{GraphFilter.EDGE_LABEL_MODES[edgeLabelModeKey]}</span>
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

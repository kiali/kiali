import * as React from 'react';
import Draggable from 'react-draggable';
import { style } from 'typestyle';
import { Button, Icon } from 'patternfly-react';

const graphLegendImage = require('../../assets/img/graph-legend.png');

export interface GraphLegendProps {
  closeLegend: () => void;
  className?: string;
}

export interface GraphLegendState {
  width: number;
  height: number;
}

const legendImageStyle = style({
  backgroundImage: `url(${graphLegendImage})`
});

export default class GraphLegend extends React.Component<GraphLegendProps, GraphLegendState> {
  constructor(props: GraphLegendProps) {
    super(props);
    this.state = {
      width: 0,
      height: 0
    };
    const image = new Image();
    image.onload = () => {
      this.setState({
        width: image.width,
        height: image.height
      });
    };
    image.src = graphLegendImage;
  }

  render() {
    if (this.state.height === 0 && this.state.width === 0) {
      return null;
    }
    const className = this.props.className ? this.props.className : '';
    return (
      <Draggable>
        <div className={`modal-content ${className}`}>
          <div className="modal-header">
            <Button className="close" bsClass="" type="" onClick={this.props.closeLegend}>
              <Icon title="Close" type="pf" name="close" />
            </Button>
            <span className="modal-title">Graph Legend</span>
          </div>
          <div
            style={{ width: this.state.width, height: this.state.height }}
            className={`modal-body ${legendImageStyle}`}
          />
        </div>
      </Draggable>
    );
  }
}

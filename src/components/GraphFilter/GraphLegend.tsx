import * as React from 'react';
import Draggable from 'react-draggable';
import { style } from 'typestyle';
import { Button, Icon } from 'patternfly-react';

// The content of the graph legend is taken from the image in src/assets/img/graph-legend.svg
// The size of content's dialog is the same as the image (it is fetched dynamically on this code)
// Any image format that can be displayed by a browser could be used.
const graphLegendImage = require('../../assets/img/graph-legend.svg');
const graphmTLSEnabledLegendImage = require('../../assets/img/graph-mtls-legend.svg');

export interface GraphLegendProps {
  closeLegend: () => void;
  className?: string;
  isMTLSEnabled: boolean;
}

export interface GraphLegendState {
  width: number;
  height: number;
}

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
    image.src = this.getLegendImage();
  }

  getLegendImageStyle() {
    return style({
      backgroundImage: `url(${this.getLegendImage()})`,
      margin: '5px 10px',
      padding: 0
    });
  }

  getLegendImage() {
    let image = graphLegendImage;

    if (this.props.isMTLSEnabled) {
      image = graphmTLSEnabledLegendImage;
    }

    return image;
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
            <Button className="close" bsClass="" onClick={this.props.closeLegend}>
              <Icon title="Close" type="pf" name="close" />
            </Button>
            <span className="modal-title">Graph Legend</span>
          </div>
          <div
            style={{ width: this.state.width, height: this.state.height }}
            className={`modal-body ${this.getLegendImageStyle()}`}
          />
        </div>
      </Draggable>
    );
  }
}

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

  render() {
    if (this.state.height === 0 && this.state.width === 0) {
      return null;
    }

    const parentClassName = this.props.className ? this.props.className : '';
    const width = 'calc(100vw - 50px - var(--pf-c-page__sidebar--md--Width))'; // 50px prevents full coverage
    const maxWidth = this.state.width + 2; // +2 includes border and prevents scroll

    const legendImageStyle = style({
      backgroundImage: `url(${this.getLegendImage()})`,
      padding: 0
    });
    const contentStyle = style({
      width: width,
      maxWidth: maxWidth,
      overflowX: 'auto',
      overflowY: 'auto'
    });
    const headerStyle = style({
      width: this.state.width
    });
    const bodyStyle = style({
      width: this.state.width,
      height: this.state.height
    });

    return (
      <Draggable bounds="#root">
        <div className={`modal-content ${parentClassName} ${contentStyle}`}>
          <div className={`modal-header ${headerStyle}`}>
            <Button className="close" bsClass="" onClick={this.props.closeLegend}>
              <Icon title="Close" type="pf" name="close" />
            </Button>
            <span className="modal-title">Graph Legend</span>
          </div>
          <div className={`modal-body ${legendImageStyle} ${bodyStyle}`} />
        </div>
      </Draggable>
    );
  }

  private getLegendImage = () => {
    return this.props.isMTLSEnabled ? graphmTLSEnabledLegendImage : graphLegendImage;
  };
}

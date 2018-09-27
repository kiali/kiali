import * as React from 'react';
import Draggable from 'react-draggable';
import { style } from 'typestyle';
import { Button, Icon } from 'patternfly-react';

// The content of the graph legend is taken from the image in src/assets/img/graph-legend.svg
// The size of content's dialog is the same as the image (it is fetched dynamically on this code)
// Any image format that can be displayed by a browser could be used.
const GraphHelpImage = require('../../assets/img/graph-help.svg');

export interface GraphHelpProps {
  closeHelp: () => void;
  className?: string;
}

export interface GraphHelpState {
  width: number;
  height: number;
}

const legendImageStyle = style({
  backgroundImage: `url(${GraphHelpImage})`,
  margin: '5px 10px',
  padding: 0,
  background: 'grey'
});

export default class GraphHelp extends React.Component<GraphHelpProps, GraphHelpState> {
  constructor(props: GraphHelpProps) {
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
    image.src = GraphHelpImage;
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
            <Button className="close" bsClass="" onClick={this.props.closeHelp}>
              <Icon title="Close" type="pf" name="close" />
            </Button>
            <span className="modal-title">Helpful information for using the graph</span>
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

import React from 'react';
import {store} from "../../../store/ConfigStore";

// TOP_PADDING constant is used to adjust the height of the main div to allow scrolling in the inner container layer.
export const TOP_PADDING = 76 + 118;

// EMBEDDED_PADDING constant is a magic number used to adjust the height of the main div to allow scrolling in the inner container layer.
// 42px is the height of the first tab menu used in iframe scenarios, this will likelely be adjusted in the future
export const EMBEDDED_PADDING = 42;

interface Props {
  className?: any;
  onResize?: (height: number) => void;
}

interface State {
  height: number;
}

export class RenderComponentScroll extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = { height: 0 };
  }

  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions = () => {
    const isStandalone = !store.getState().globalState.isKiosk;
    const topPadding = isStandalone ? TOP_PADDING : EMBEDDED_PADDING;
    this.setState(
      {
        height: window.innerHeight - topPadding
      },
      () => {
        if (this.props.onResize) {
          this.props.onResize(this.state.height);
        }
      }
    );
  };

  render() {
    return (
      <div
        style={{ height: this.state.height, overflowY: 'auto', padding: '20px' }}
        className={this.props.className ? this.props.className : undefined}
      >
        {this.props.children}
      </div>
    );
  }
}

import React from 'react';

// TOP_PADDING constant is used to adjust the height of the main div to allow scrolling in the inner container layer.
export const TOP_PADDING = 76 + 118;

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
    this.setState(
      {
        height: window.innerHeight - TOP_PADDING
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

import React from 'react';

export class RenderComponentScroll extends React.Component<{}, { height: number }> {
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
    this.setState({ height: window.innerHeight * 0.7 });
  };

  render() {
    return <div style={{ height: this.state.height, overflowY: 'auto' }}>{this.props.children}</div>;
  }
}

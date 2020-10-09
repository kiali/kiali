import React from 'react';

// TOP_PADDING constant is used to adjust the height of the main div to allow scrolling in the inner container layer.
// Overview page
// 76px (header) + 76px (overview toolbar)
const TOP_PADDING_OVERVIEW_NO_FILTER = 76 + 76;
// 76px (header) + 128px (overview toolbar + filters)
const TOP_PADDING_OVERVIEW_FILTERED = 76 + 128;
// List & Details pages
// 76px (header) + 118px (breadcrumb + title)
const TOP_PADDING = 76 + 118;

interface Props {
  className?: any;
  overview?: boolean;
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

  componentDidUpdate(prevProps: Props) {
    if (prevProps.overview !== this.props.overview) {
      this.updateWindowDimensions();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions = () => {
    let topPadding = TOP_PADDING;
    if (this.props.overview !== undefined) {
      topPadding = this.props.overview ? TOP_PADDING_OVERVIEW_FILTERED : TOP_PADDING_OVERVIEW_NO_FILTER;
    }
    this.setState({ height: window.innerHeight - topPadding });
  };

  render() {
    return (
      <div
        style={{ height: this.state.height, overflowY: 'auto', padding: '10px' }}
        className={this.props.className ? this.props.className : undefined}
      >
        {this.props.children}
      </div>
    );
  }
}

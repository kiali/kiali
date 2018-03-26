import * as React from 'react';

interface BadgeProps {
  scale: number;
  style: string;
  color: string;
  leftText: string;
  rightText: string;
}

interface BadgeState {
  leftWidth: number;
  rightWidth: number;
}
class Badge extends React.Component<BadgeProps, BadgeState> {
  private textLeftText: SVGTextContentElement | null;
  private textRightText: SVGTextContentElement | null;

  constructor(props: BadgeProps) {
    super(props);
    this.state = {
      leftWidth: 0,
      rightWidth: 0
    };
    this.updateTextLength = this.updateTextLength.bind(this);
  }
  componentDidMount() {
    this.updateTextLength();
  }
  componentDidUpdate() {
    this.updateTextLength();
  }
  updateTextLength() {
    let leftTextLength = this.TextLength(this.textLeftText);
    let rightTextLength = this.TextLength(this.textRightText);
    if (leftTextLength !== this.state.leftWidth || rightTextLength !== this.state.rightWidth) {
      this.setState({
        leftWidth: leftTextLength,
        rightWidth: rightTextLength
      });
    }
  }
  TextLength(node: SVGTextContentElement | null) {
    return Math.round(node ? node.getComputedTextLength() : 0);
  }
  render() {
    let minorMargin = this.props.scale;
    let majorMargin = 5 * this.props.scale;
    let textMargin = minorMargin + majorMargin;
    let fullWidth = textMargin * 4 + (this.state.leftWidth + this.state.rightWidth);
    let rightOffset = textMargin * 2 + this.state.leftWidth;
    let rightWidth = textMargin * 2 + this.state.rightWidth;
    let height = 20 * this.props.scale;
    let textSize = 11 * this.props.scale;
    let borderRadius = 3 * this.props.scale * (this.props.style === 'square' ? 0 : 1);
    return (
      <svg
        height={height}
        width={fullWidth}
        zoomAndPan="magnify"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        version="1.0"
        style={{ marginLeft: '5px' }}
      >
        <linearGradient id="a" x2="0" y2={this.props.style === 'plastic' ? '100%' : '0'}>
          <stop stopOpacity=".1" stopColor="#bbb" offset="0" />
          <stop stopOpacity=".1" offset="1" />
        </linearGradient>
        <rect rx={borderRadius} fill="#555" width={fullWidth} height={height} />
        <rect rx={borderRadius} fill={this.props.color} width={rightWidth} x={rightOffset} height={height} />
        <rect fill={this.props.color} x={rightOffset} width="13" height={height} />
        <rect rx={borderRadius} fill="url(#a)" width={fullWidth} height={height} />
        <g fontSize={textSize} fontFamily="DejaVu Sans,Verdana,Geneva,sans-serif" fill="#fff">
          <text
            ref={ref => (this.textLeftText = ref)}
            x={textMargin}
            fill="#010101"
            fillOpacity=".3"
            y={height - majorMargin}
          >
            {this.props.leftText}
          </text>
          <text x={textMargin} y={height - majorMargin - minorMargin}>
            {this.props.leftText}
          </text>
          <text
            ref={ref => (this.textRightText = ref)}
            fill="#010101"
            x={rightOffset + textMargin}
            fillOpacity=".3"
            y={height - majorMargin}
          >
            {this.props.rightText}
          </text>
          <text x={rightOffset + textMargin} y={height - majorMargin - minorMargin}>
            {this.props.rightText}
          </text>
        </g>
      </svg>
    );
  }
}

export default Badge;

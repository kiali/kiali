import * as React from 'react';

type Rect = ClientRect | DOMRect;

export enum PropertyType {
  VIEWPORT_HEIGHT_MINUS_TOP
}

export type Property = {
  type: PropertyType;
  margin?: number;
};

type ComputeOffsetProps = {
  className: string;
  maxHeight?: Property;
  handleBoundingClientRect?(rect: Rect): void;
};

type ComputeOffsetState = {
  maxHeight?: string;
};

export const vhMinusTop = (rect: Rect, offset: number) => `calc(100vh - ${rect.top + offset}px)`;

// Computes the BoundingClientRect of the container, this helps to calculate the remaining height without
// going further off the screen and without having to fix the value in the code.
// Note: This does re-compute when there is a change in this component, but external changes are not yet
// managed, that might require to observe the offsets, for our current use case this seems OK, as the top
// headers doesn't change in height.
export class BoundingClientAwareComponent extends React.Component<ComputeOffsetProps, ComputeOffsetState> {
  private readonly containerRef: React.RefObject<HTMLDivElement>;

  constructor(props: ComputeOffsetProps) {
    super(props);
    this.containerRef = React.createRef<HTMLDivElement>();
    this.state = {};
  }

  componentDidMount() {
    this.handleComponentUpdated();
  }

  componentDidUpdate() {
    this.handleComponentUpdated();
  }

  handleComponentUpdated() {
    const rect = this.containerRef.current!.getBoundingClientRect();

    const stateUpdate: ComputeOffsetState = {};

    if (this.props.maxHeight) {
      const updatedValue = this.processProperty(this.props.maxHeight, rect);
      if (updatedValue !== this.state.maxHeight) {
        stateUpdate.maxHeight = updatedValue;
      }
    }

    if (Object.values(stateUpdate).length > 0) {
      this.setState(stateUpdate);
    }

    if (this.props.handleBoundingClientRect) {
      this.props.handleBoundingClientRect(rect);
    }
  }

  render() {
    const style = {
      maxHeight: this.state.maxHeight
    };

    return (
      <div className={this.props.className} style={style} ref={this.containerRef}>
        {this.props.children}
      </div>
    );
  }

  private processProperty(property: Property, rect: Rect) {
    const margin = property.margin ? property.margin : 0;
    switch (property.type) {
      case PropertyType.VIEWPORT_HEIGHT_MINUS_TOP:
        return vhMinusTop(rect, margin);
      default:
        throw Error('Undefined property type:' + property.type);
    }
  }
}

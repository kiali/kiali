// Clone of Slider component to workaround issue https://github.com/patternfly/patternfly-react/issues/1221
import * as React from 'react';
import { sliderMirroredStyle, sliderStyle } from './SliderStyle';
import sliderCss from './Slider.module.scss';
import { classes } from 'typestyle';

type BoundariesProps = {
  max: number;
  min: number;
  mirrored: boolean;
  reversed: boolean;
  showBoundaries: boolean;
  slider?: React.ReactNode;
};

export class Boundaries extends React.Component<BoundariesProps, {}> {
  static defaultProps = {
    min: 0,
    max: 100,
    reversed: false,
    showBoundaries: false
  };

  render(): React.ReactNode {
    const { children, min, max, reversed, showBoundaries, slider } = this.props;

    const minElement = <b>{min}</b>;
    const maxElement = <b>{max}</b>;

    let leftBoundary: React.ReactNode = null;
    let rightBoundary: React.ReactNode = null;

    if (showBoundaries) {
      if (reversed) {
        leftBoundary = maxElement;
        rightBoundary = minElement;
      } else {
        leftBoundary = minElement;
        rightBoundary = maxElement;
      }
    }

    return (
      <div className={classes(sliderCss.style, sliderStyle, this.props.mirrored && sliderMirroredStyle)}>
        {leftBoundary}
        {slider}
        {rightBoundary}
        {children}
      </div>
    );
  }
}

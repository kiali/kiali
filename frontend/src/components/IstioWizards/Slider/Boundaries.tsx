// Clone of Slider component to workaround issue https://github.com/patternfly/patternfly-react/issues/1221
import React from 'react';
import { sliderMirroredStyle, sliderStyle } from './SliderStyle';
import sliderCss from './Slider.module.scss';
import { classes } from 'typestyle';

type BoundariesProps = {
  min: number;
  max: number;
  reversed: boolean;
  showBoundaries: boolean;
  mirrored: boolean;
  slider?: JSX.Element;
};

export class Boundaries extends React.Component<BoundariesProps, {}> {
  static defaultProps = {
    min: 0,
    max: 100,
    reversed: false,
    showBoundaries: false
  };

  render() {
    const { children, min, max, reversed, showBoundaries, slider } = this.props;

    const minElement = <b>{min}</b>;
    const maxElement = <b>{max}</b>;

    let leftBoundary: JSX.Element | null = null;
    let rightBoundary: JSX.Element | null = null;

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

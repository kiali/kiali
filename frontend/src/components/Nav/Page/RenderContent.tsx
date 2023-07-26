import React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { bgDark, bgLight } from 'styles/ThemeStyle';
import { Theme } from 'types/Common';
import { classes } from 'typestyle';
import { RenderComponentScroll } from './RenderComponentScroll';

const containerPadding = kialiStyle({ padding: '30px 20px 0 20px' });

export class RenderContent extends React.Component<{ needScroll?: boolean; theme?: string }> {
  render() {
    return (
      <RenderComponentScroll
        className={classes(
          containerPadding,
          this.props.theme === Theme.Light ? bgLight : this.props.theme === Theme.Dark ? bgDark : ''
        )}
      >
        <div>{this.props.children}</div>
      </RenderComponentScroll>
    );
  }
}

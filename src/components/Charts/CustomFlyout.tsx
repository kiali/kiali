import * as React from 'react';
import { Flyout } from 'victory';

export const CustomFlyout = (props: any) => {
  return <Flyout {...props} width={props.width + 15} style={{ ...props.style, stroke: 'none', fillOpacity: 0.6 }} />;
};

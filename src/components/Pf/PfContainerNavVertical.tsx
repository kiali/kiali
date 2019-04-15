import React from 'react';
import { Toolbar, ToolbarGroup } from '@patternfly/react-core';

const PfContainerNavVertical = props => {
  return (
    <Toolbar>
      <ToolbarGroup>{props.children}</ToolbarGroup>
    </Toolbar>
  );
};

export default PfContainerNavVertical;

import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { prettyProtocol } from 'types/Graph';
import { EdgeContextMenuProps } from '../CytoscapeContextMenu';
import { getTitle } from 'pages/Graph/SummaryPanelCommon';
import { renderBadgedName } from 'pages/Graph/SummaryLink';
import { decoratedNodeData } from '../CytoscapeGraphUtils';
import { EdgeSingular } from 'cytoscape';

const contextMenu = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  textAlign: 'left'
});

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = (props: EdgeContextMenuProps) => {
  return (
    <div className={contextMenu}>
      {getTitle(`Edge (${prettyProtocol(props.protocol)})`)}
      {renderBadgedName(decoratedNodeData((props.element as EdgeSingular).source()), 'From:  ')}
      {renderBadgedName(decoratedNodeData((props.element as EdgeSingular).target()), 'To:        ')}
    </div>
  );
};

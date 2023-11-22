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

export class EdgeContextMenu extends React.PureComponent<EdgeContextMenuProps> {
  render() {
    return (
      <div className={contextMenu}>
        {getTitle($t(`Edge (${prettyProtocol(this.props.protocol)})`))}
        {renderBadgedName(decoratedNodeData((this.props.element as EdgeSingular).source()), 'From:  ')}
        {renderBadgedName(decoratedNodeData((this.props.element as EdgeSingular).target()), 'To:        ')}
      </div>
    );
  }
}

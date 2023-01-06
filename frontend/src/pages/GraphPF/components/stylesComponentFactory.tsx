import {
  ComponentFactory,
  ContextMenuItem,
  GraphComponent,
  GraphElement,
  ModelKind,
  nodeDragSourceSpec,
  withContextMenu,
  withDragNode,
  withPanZoom,
  withSelection
} from '@patternfly/react-topology';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { clickHandler, getOptions } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import * as React from 'react';
import StyleEdge from '../styles/styleEdge';
import StyleGroup from '../styles/styleGroup';
import StyleNode from '../styles/styleNode';

const nodeContextMenu = (node: GraphElement): React.ReactElement[] => {
  const options = getOptions(node.getData());
  const items = options.map((o, i) => {
    return (
      // TODO: fix kiosk param
      <ContextMenuItem key={`option-${i}`} onClick={() => clickHandler(o, '')}>
        {o.text} {o.target === '_blank' && <ExternalLinkAltIcon />}
      </ContextMenuItem>
    );
  });

  return items;
};

export const stylesComponentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): React.FunctionComponent<any> | undefined => {
  switch (kind) {
    case ModelKind.edge:
      return withSelection({ multiSelect: false, controlled: false })(StyleEdge as any);
    case ModelKind.graph:
      return withPanZoom()(GraphComponent);
    case ModelKind.node: {
      return withDragNode(nodeDragSourceSpec('node', true, true))(
        withContextMenu(e => nodeContextMenu(e))(
          withSelection({ multiSelect: false, controlled: false })((type === 'group' ? StyleGroup : StyleNode) as any)
        )
      );
    }
    default:
      return undefined;
  }
};

export default stylesComponentFactory;

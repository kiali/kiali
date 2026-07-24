import * as React from 'react';
import { useResizeDetector } from 'react-resize-detector';

export const TOPOLOGY_GRAPH_CONTAINER_ID = 'pft-graph';
export const TOPOLOGY_MESH_CONTAINER_ID = 'mesh-container';

// Prefer over document.body — side panels resize these containers, not the body.
// Falls back to document.body when neither container exists (e.g., non-topology pages).
export const getTopologyResizeTarget = (): HTMLElement =>
  document.getElementById(TOPOLOGY_GRAPH_CONTAINER_ID) ??
  document.getElementById(TOPOLOGY_MESH_CONTAINER_ID) ??
  document.body;

export const useTopologyResize = (onResize: () => void): void => {
  const resizeTargetRef = React.useRef<HTMLElement>(getTopologyResizeTarget());

  useResizeDetector({
    targetRef: resizeTargetRef,
    disableRerender: true,
    refreshMode: 'debounce',
    refreshRate: 100,
    skipOnMount: true,
    handleWidth: true,
    handleHeight: true,
    onResize
  });
};

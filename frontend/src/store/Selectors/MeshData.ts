import {
  DecoratedMeshEdgeData,
  DecoratedMeshEdgeWrapper,
  DecoratedMeshElements,
  DecoratedMeshNodeData,
  DecoratedMeshNodeWrapper,
  MeshEdgeWrapper,
  MeshElements,
  MeshNodeWrapper
} from '../../types/Mesh';
import { NA } from 'types/Health';

// When updating the mesh, the element data expects to have all the changes
// non-provided values are taken as "this didn't change", similar as setState does.
// Put default values for all fields that are omitted.
export const decorateMeshData = (meshData: MeshElements): DecoratedMeshElements => {
  const elementsDefaults = {
    edges: {
      isMTLS: -1
    },
    nodes: {
      healthData: undefined,
      health: undefined,
      isBox: undefined,
      isInaccessible: undefined,
      isIstio: undefined
    }
  };

  const decoratedMesh: DecoratedMeshElements = {};
  if (meshData) {
    if (meshData.nodes) {
      decoratedMesh.nodes = meshData.nodes.map((node: MeshNodeWrapper) => {
        const decoratedNode: any = { ...node };
        // Calculate health
        if (decoratedNode.data.healthData) {
          decoratedNode.data.healthStatus = NA.name;
        }
        decoratedNode.data = { ...elementsDefaults.nodes, ...decoratedNode.data } as DecoratedMeshNodeData;
        return decoratedNode as DecoratedMeshNodeWrapper;
      });
    }
    if (meshData.edges) {
      decoratedMesh.edges = meshData.edges.map((edge: MeshEdgeWrapper) => {
        const decoratedEdge: any = { ...edge };
        decoratedEdge.data = { ...elementsDefaults.edges, ...decoratedEdge.data } as DecoratedMeshEdgeData;
        return decoratedEdge as DecoratedMeshEdgeWrapper;
      });
    }
  }
  return decoratedMesh;
};

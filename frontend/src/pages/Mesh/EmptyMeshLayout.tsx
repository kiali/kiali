import * as React from 'react';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  EmptyStateVariant,
  EmptyStateHeader,
  EmptyStateFooter
} from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import * as _ from 'lodash';
import { KialiIcon } from '../../config/KialiIcon';
import { DecoratedMeshElements } from 'types/Mesh';

type EmptyMeshLayoutProps = {
  action?: any;
  elements?: DecoratedMeshElements;
  isLoading?: boolean;
  isError: boolean;
  isMiniMesh: boolean;
  error?: string;
};

const emptyStateStyle = kialiStyle({
  height: '98%',
  marginRight: 'auto',
  marginLeft: 'auto',
  marginBottom: 10,
  marginTop: 10
});

type EmptyMeshLayoutState = {};

export class EmptyMeshLayout extends React.Component<EmptyMeshLayoutProps, EmptyMeshLayoutState> {
  shouldComponentUpdate(nextProps: EmptyMeshLayoutProps) {
    const currentIsEmpty = this.props.elements === undefined || _.isEmpty(this.props.elements.nodes);
    const nextIsEmpty = nextProps.elements === undefined || _.isEmpty(nextProps.elements.nodes);

    // Update if we have elements and we are not loading
    if (!nextProps.isLoading && !nextIsEmpty) {
      return true;
    }

    // Update if we are going from having no elements to having elements or vice versa
    if (currentIsEmpty !== nextIsEmpty) {
      return true;
    }

    // Do not update if we have elements, as this means we are refreshing
    return nextIsEmpty;
  }

  render() {
    if (this.props.isError) {
      return (
        <EmptyState id="empty-mesh-error" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateHeader
            titleText="Error loading Mesh"
            icon={<EmptyStateIcon icon={KialiIcon.Error} />}
            headingLevel="h5"
          />
          <EmptyStateBody>{this.props.error}</EmptyStateBody>
        </EmptyState>
      );
    }
    if (this.props.isLoading) {
      return (
        <EmptyState id="empty-mesh-is-loading" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateHeader titleText="Loading Mesh" headingLevel="h5" />
        </EmptyState>
      );
    }

    const isMeshEmpty = !this.props.elements || !this.props.elements.nodes || this.props.elements.nodes.length < 1;

    if (isMeshEmpty && !this.props.isMiniMesh) {
      return (
        <EmptyState id="empty-mesh" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateHeader titleText="Empty Mesh" headingLevel="h5" />
          <EmptyStateBody>
            There is currently no mesh information available. This may mean you do not have permission to see any mesh
            information or have no access to any of the mesh namespaces.
          </EmptyStateBody>
          <EmptyStateFooter></EmptyStateFooter>
        </EmptyState>
      );
    }

    if (isMeshEmpty && this.props.isMiniMesh) {
      return (
        <EmptyState id="empty-mini-mesh" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateHeader titleText="Empty Mesh" headingLevel="h5" />
          <EmptyStateBody>No mesh information available.</EmptyStateBody>
        </EmptyState>
      );
    }

    return this.props.children;
  }
}

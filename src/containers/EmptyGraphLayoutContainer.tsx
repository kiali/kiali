import * as React from 'react';
import { connect } from 'react-redux';
import {
  Button,
  EmptyState,
  EmptyStateTitle,
  EmptyStateIcon,
  EmptyStateInfo,
  EmptyStateAction
} from 'patternfly-react';
import { style } from 'typestyle';
import * as _ from 'lodash';
import { KialiAppState } from '../store/Store';

const mapStateToProps = (state: KialiAppState) => {
  return {
    error: state.graph.error
  };
};

type EmptyGraphLayoutProps = {
  elements?: any;
  namespace?: string;
  action?: any;
  isLoading?: boolean;
  isError: boolean;
  error?: string;
};

const emptyStateStyle = style({
  height: '98%',
  marginRight: 5,
  marginBottom: 10,
  marginTop: 10
});

type EmptyGraphLayoutState = {};

export class EmptyGraphLayout extends React.Component<EmptyGraphLayoutProps, EmptyGraphLayoutState> {
  shouldComponentUpdate(nextProps: EmptyGraphLayoutProps) {
    const currentIsEmpty = _.isEmpty(this.props.elements.nodes);
    const nextIsEmpty = _.isEmpty(nextProps.elements.nodes);

    // Update if we have elements and we are not loading
    if (!nextProps.isLoading && !nextIsEmpty) {
      return true;
    }

    // Update if we are going from having no elements to having elements or vice versa
    if (currentIsEmpty !== nextIsEmpty) {
      return true;
    }
    // Do not update if we have elements and the namespace didn't change, as this means we are refreshing
    return !(!nextIsEmpty && this.props.namespace === nextProps.namespace);
  }

  render() {
    if (this.props.isError) {
      return (
        <EmptyState className={emptyStateStyle}>
          <EmptyStateIcon name="error-circle-o" />
          <EmptyStateTitle>Error loading Graph</EmptyStateTitle>
          <EmptyStateInfo>{this.props.error}</EmptyStateInfo>
        </EmptyState>
      );
    }
    if (this.props.isLoading) {
      return (
        <EmptyState className={emptyStateStyle}>
          <EmptyStateTitle>Loading Graph</EmptyStateTitle>
        </EmptyState>
      );
    }

    const isGraphEmpty = !this.props.elements || !this.props.elements.nodes || this.props.elements.nodes.length < 1;

    if (isGraphEmpty) {
      return (
        <EmptyState className={emptyStateStyle}>
          <EmptyStateTitle>Empty Graph</EmptyStateTitle>
          <EmptyStateInfo>
            There is currently no graph available for namespace <b>{this.props.namespace}</b>. This could either mean
            there are no service mesh available in this namespace or that nothing has accessed the service mesh. Please
            try accessing something in the service mesh and click 'Refresh'.
          </EmptyStateInfo>
          <EmptyStateAction>
            <Button bsStyle="primary" bsSize="large" onClick={this.props.action}>
              Refresh
            </Button>
          </EmptyStateAction>
        </EmptyState>
      );
    } else {
      return this.props.children;
    }
  }
}

const EmptyGraphLayoutContainer = connect(
  mapStateToProps,
  null
)(EmptyGraphLayout);
export default EmptyGraphLayoutContainer;

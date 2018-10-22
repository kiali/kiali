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
import { GraphFilterActions } from '../actions/GraphFilterActions';
import { bindActionCreators } from 'redux';

const mapStateToProps = (state: KialiAppState) => {
  return {
    error: state.graph.error,
    isDisplayingUnusedNodes: state.graph.filterState.showUnusedNodes
  };
};

const mapDispatchToProps = (dispatch: any) => {
  return {
    displayUnusedNodes: bindActionCreators(GraphFilterActions.toggleUnusedNodes, dispatch)
  };
};

type EmptyGraphLayoutProps = {
  elements?: any;
  namespace?: string;
  action?: any;
  displayUnusedNodes: () => void;
  isDisplayingUnusedNodes: boolean;
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
            there is no service mesh available for this namespace or the service mesh has yet to see request traffic.
            {this.props.isDisplayingUnusedNodes && (
              <> You are currently displaying 'Unused nodes', send requests to the service mesh and click 'Refresh'.</>
            )}
            {!this.props.isDisplayingUnusedNodes && (
              <>
                {' '}
                You can enable 'Unused nodes' to display service mesh nodes that have yet to see any request traffic.
              </>
            )}
          </EmptyStateInfo>
          <EmptyStateAction>
            <Button
              bsStyle="primary"
              bsSize="large"
              onClick={this.props.isDisplayingUnusedNodes ? this.props.action : this.props.displayUnusedNodes}
            >
              {(this.props.isDisplayingUnusedNodes && <>Refresh</>) || <>Display unused nodes</>}
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
  mapDispatchToProps
)(EmptyGraphLayout);
export default EmptyGraphLayoutContainer;

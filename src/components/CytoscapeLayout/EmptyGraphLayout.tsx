import * as React from 'react';
import { Button, EmptyState, EmptyStateTitle, EmptyStateInfo, EmptyStateAction } from 'patternfly-react';

type EmptyGraphLayoutProps = {
  elements: any;
  namespace: string;
  action: any;
};

type EmptyGraphLayoutState = {};

export default class EmptyGraphLayout extends React.Component<EmptyGraphLayoutProps, EmptyGraphLayoutState> {
  render() {
    if (this.props.elements === undefined || this.props.elements.length < 1 || this.props.elements.nodes.length < 1) {
      return (
        <div>
          <EmptyState>
            <EmptyStateTitle>Empty Service Graph</EmptyStateTitle>
            <EmptyStateInfo>
              There is currently no service graph available for namespace <b>{this.props.namespace}</b>. This could
              either mean there are no service mesh available in this namespace or that nothing has accessed the service
              mesh. Please try accessing something in the service mesh and click 'Refresh'.
            </EmptyStateInfo>
            <EmptyStateAction>
              <Button bsStyle="primary" bsSize="large" onClick={this.props.action}>
                Refresh
              </Button>
            </EmptyStateAction>
          </EmptyState>
        </div>
      );
    } else {
      return this.props.children;
    }
  }
}

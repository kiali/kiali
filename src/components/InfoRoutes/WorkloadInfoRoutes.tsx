import * as React from 'react';
import InfoRoutes, { Route } from './InfoRoutes';

interface Props {
  dependencies: { [key: string]: Route[] };
}

export class WorkloadInfoRoutes extends React.Component<Props> {
  render() {
    return <InfoRoutes direction={'From'} resourceUrl={'services'} dependencies={this.props.dependencies} />;
  }
}

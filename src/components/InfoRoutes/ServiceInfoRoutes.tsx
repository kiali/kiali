import * as React from 'react';
import InfoRoutes, { Route } from './InfoRoutes';

interface Props {
  dependencies: { [key: string]: Route[] };
}

export class ServiceInfoRoutes extends React.Component<Props> {
  render() {
    return <InfoRoutes direction={'To'} resourceUrl={'workloads'} dependencies={this.props.dependencies} />;
  }
}

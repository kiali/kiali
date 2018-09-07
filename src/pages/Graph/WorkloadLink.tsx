import * as React from 'react';
import { Link } from 'react-router-dom';

interface WorkloadLinkProperties {
  workload: string;
  namespace: string;
}

export default class WorkloadLink extends React.PureComponent<WorkloadLinkProperties> {
  render() {
    if (this.props.workload === 'unknown') {
      return <span>{this.props.workload}</span>;
    }
    return (
      <Link
        to={`/namespaces/${encodeURIComponent(this.props.namespace)}/workloads/${encodeURIComponent(
          this.props.workload
        )}`}
        key={`${this.props.namespace}.${this.props.workload}`}
      >
        {this.props.workload}
      </Link>
    );
  }
}

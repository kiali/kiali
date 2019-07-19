import * as React from 'react';

interface UpstreamDetectorProps {
  readonly upstream: React.Component;
  readonly downstream: React.Component;
}

export const isUpstream = process.env.REACT_APP_IS_UPSTREAM === 'true';

export default class UpstreamDetector extends React.PureComponent<UpstreamDetectorProps> {
  public render() {
    return isUpstream ? this.props.upstream : this.props.downstream;
  }
}

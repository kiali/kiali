import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'patternfly-react';
import { Paths } from '../../config';

type Props = {
  name: string;
};

class OverviewCardLinks extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div>
        <Link to={`/graph/namespaces?namespaces=` + this.props.name} title="Graph">
          <Icon type="pf" name="topology" style={{ paddingLeft: 10, paddingRight: 10 }} />
        </Link>
        <Link to={`/${Paths.APPLICATIONS}?namespaces=` + this.props.name} title="Applications list">
          <Icon type="pf" name="applications" style={{ paddingLeft: 10, paddingRight: 10 }} />
        </Link>
        <Link to={`/${Paths.WORKLOADS}?namespaces=` + this.props.name} title="Workloads list">
          <Icon type="pf" name="bundle" style={{ paddingLeft: 10, paddingRight: 10 }} />
        </Link>
        <Link to={`/${Paths.SERVICES}?namespaces=` + this.props.name} title="Services list">
          <Icon type="pf" name="service" style={{ paddingLeft: 10, paddingRight: 10 }} />
        </Link>
        <Link to={`/${Paths.ISTIO}?namespaces=` + this.props.name} title="Istio Config list">
          <Icon type="pf" name="template" style={{ paddingLeft: 10, paddingRight: 10 }} />
        </Link>
      </div>
    );
  }
}

export default OverviewCardLinks;

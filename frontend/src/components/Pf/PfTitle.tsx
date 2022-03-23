import * as React from 'react';
import MissingSidecar from '../../components/MissingSidecar/MissingSidecar';
import { ServiceIcon, BundleIcon, ApplicationsIcon } from '@patternfly/react-icons';
import { style } from 'typestyle';

const PfTitleStyle = style({
  fontSize: '19px',
  fontWeight: 400,
  margin: '20px 0',
  padding: '0'
});

interface PfTitleProps {
  location?: {
    pathname: string;
    search: string;
  };
  istio?: boolean;
}

interface PfTitleState {
  type: string;
  namespace: string;
  name: string;
  cytoscapeGraph: string;
  graphType: string;
  icon: JSX.Element;
}

const namespaceRegex = /namespaces\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)(\/([a-z0-9-]+))?(\/([a-z0-9-]+))?/;

class PfTitle extends React.Component<PfTitleProps, PfTitleState> {
  constructor(props: PfTitleProps) {
    super(props);
    this.state = {
      type: '',
      namespace: '',
      name: '',
      cytoscapeGraph: '',
      graphType: '',
      icon: <></>
    };
  }

  doRefresh() {
    let type,
      ns,
      graphType,
      name = '';
    let icon: JSX.Element = <></>;
    if (this.props.location) {
      const match = this.props.location.pathname.match(namespaceRegex) || [];
      ns = match[1];
      type = match[2];
      name = match[3];
    }
    switch (type) {
      case 'services':
        graphType = 'service';
        icon = <ServiceIcon />;
        break;
      case 'workloads':
        graphType = 'workload';
        icon = <BundleIcon />;
        break;
      case 'applications':
        graphType = 'app';
        icon = <ApplicationsIcon />;
        break;
      default:
    }
    this.setState({
      namespace: ns,
      type: type,
      name: name,
      graphType: graphType,
      icon: icon
    });
  }

  componentDidMount(): void {
    this.doRefresh();
  }

  componentDidUpdate(prevProps: Readonly<PfTitleProps>): void {
    if (
      this.props.location &&
      prevProps.location &&
      (this.props.location.pathname !== prevProps.location.pathname ||
        this.props.location.search !== prevProps.location.search ||
        this.props.istio !== prevProps.istio)
    ) {
      this.doRefresh();
    }
  }

  render() {
    return (
      <h2 className={PfTitleStyle}>
        {this.state.icon} {this.state.name}
        {this.state.name && this.props.istio !== undefined && !this.props.istio && (
          <span style={{ marginLeft: '10px' }}>
            <MissingSidecar namespace={this.state.namespace} />
          </span>
        )}
      </h2>
    );
  }
}

export default PfTitle;

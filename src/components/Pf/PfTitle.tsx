import * as React from 'react';
import MissingSidecar from '../../components/MissingSidecar/MissingSidecar';
import { Link } from 'react-router-dom';
import { ServiceIcon, BundleIcon, ApplicationsIcon } from '@patternfly/react-icons';
import { CytoscapeGraphSelectorBuilder } from '../CytoscapeGraph/CytoscapeGraphSelector';
import { style } from 'typestyle';
import { NodeType } from '../../types/Graph';

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

class PfTitle extends React.Component<PfTitleProps, PfTitleState> {
  constructor(props: PfTitleProps) {
    super(props);
    const namespaceRegex = /namespaces\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)(\/([a-z0-9-]+))?(\/([a-z0-9-]+))?/;
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
    let cytoscapeGraph = new CytoscapeGraphSelectorBuilder().namespace(ns);

    switch (type) {
      case 'services':
        graphType = 'service';
        cytoscapeGraph = cytoscapeGraph.service(name);
        icon = <ServiceIcon />;
        break;
      case 'workloads':
        graphType = 'workload';
        cytoscapeGraph = cytoscapeGraph.workload(name);
        icon = <BundleIcon />;
        break;
      case 'applications':
        graphType = 'app';
        cytoscapeGraph = cytoscapeGraph
          .app(name)
          .nodeType(NodeType.APP)
          .isGroup(null);
        icon = <ApplicationsIcon />;
        break;
      default:
    }

    this.state = {
      namespace: ns,
      type: type,
      name: name,
      graphType: graphType,
      icon: icon,
      cytoscapeGraph: cytoscapeGraph.build()
    };
  }

  showOnGraphLink() {
    return `/graph/namespaces?graphType=${this.state.graphType}&injectServiceNodes=true&namespaces=${
      this.state.namespace
    }&unusedNodes=true&focusSelector=${encodeURI(this.state.cytoscapeGraph)}`;
  }

  render() {
    return (
      <h2 className={PfTitleStyle}>
        {this.state.icon} {this.state.name}
        {this.state.name && this.props.istio !== undefined && !this.props.istio && (
          <span style={{ marginLeft: '10px' }}>
            <MissingSidecar />
          </span>
        )}
        {this.state.name && (
          <>
            {'  '}(<Link to={this.showOnGraphLink()}>Show on graph</Link>)
          </>
        )}
      </h2>
    );
  }
}

export default PfTitle;

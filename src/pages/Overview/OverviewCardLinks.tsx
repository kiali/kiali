import * as React from 'react';
import { Link } from 'react-router-dom';
import { Tooltip } from '@patternfly/react-core';
import { style } from 'typestyle';
import { Paths } from '../../config';
import { ApplicationsIcon, BundleIcon, TopologyIcon, ServiceIcon, PficonTemplateIcon } from '@patternfly/react-icons';
import { OverviewType } from './OverviewToolbar';
import { GraphType } from 'types/Graph';

type Props = {
  name: string;
  overviewType: OverviewType;
};

const iconStyle = style({
  paddingLeft: 10,
  paddingRight: 10
});

class OverviewCardLinks extends React.Component<Props> {
  render() {
    const tooltipProps = { distance: 10, entryDelay: 100, exitDelay: 100 };
    return (
      <div style={{ marginTop: '10px' }}>
        <Tooltip key="ot_graph" content={<>Go to graph</>} {...tooltipProps}>
          <Link
            to={`/graph/namespaces?namespaces=${this.props.name}&graphType=${this.toGraphType(
              this.props.overviewType
            )}`}
            className={iconStyle}
          >
            <TopologyIcon />
          </Link>
        </Tooltip>
        <Tooltip key="ot_apps" content={<>Go to applications</>} {...tooltipProps}>
          <Link to={`/${Paths.APPLICATIONS}?namespaces=` + this.props.name} className={iconStyle}>
            <ApplicationsIcon />
          </Link>
        </Tooltip>
        <Tooltip key="ot_workloads" content={<>Go to workloads</>} {...tooltipProps}>
          <Link to={`/${Paths.WORKLOADS}?namespaces=` + this.props.name} className={iconStyle}>
            <BundleIcon />
          </Link>
        </Tooltip>
        <Tooltip key="ot_services" content={<>Go to services</>} {...tooltipProps}>
          <Link to={`/${Paths.SERVICES}?namespaces=` + this.props.name} className={iconStyle}>
            <ServiceIcon />
          </Link>
        </Tooltip>
        <Tooltip key="ot_istio" content={<>Go to Istio config</>} {...tooltipProps}>
          <Link to={`/${Paths.ISTIO}?namespaces=` + this.props.name} className={iconStyle}>
            <PficonTemplateIcon />
          </Link>
        </Tooltip>
      </div>
    );
  }

  private toGraphType = (overviewType: OverviewType): string => {
    switch (overviewType) {
      case 'app':
        return GraphType.APP;
      case 'service':
        return GraphType.SERVICE;

      default:
        return GraphType.WORKLOAD;
    }
  };
}

export default OverviewCardLinks;

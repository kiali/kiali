import * as React from 'react';
import { Icon } from 'patternfly-react';

import * as H from '../../types/Health';

export enum DisplayMode {
  LARGE,
  SMALL
}

interface Props {
  health?: H.Health;
  mode: DisplayMode;
}

interface Status {
  name: string;
  color: string;
  priority: number;
  jsx: (size?: string) => JSX.Element;
}

// Colors from Patternfly status palette https://www.patternfly.org/styles/color-palette/
const FAILURE: Status = {
  name: 'Failure',
  color: '#cc0000',
  priority: 3,
  jsx: size => <Icon type="pf" name="error-circle-o" style={{ fontSize: size }} />
};
const DEGRADED: Status = {
  name: 'Degraded',
  color: '#ec7a08',
  priority: 2,
  jsx: size => <Icon type="pf" name="warning-triangle-o" style={{ fontSize: size }} />
};
const HEALTHY: Status = {
  name: 'Healthy',
  color: '#3f9c35',
  priority: 1,
  jsx: size => <Icon type="pf" name="ok" style={{ fontSize: size }} />
};
const NA: Status = {
  name: 'No health information',
  color: '#707070',
  priority: 0,
  jsx: size => <span style={{ color: '#707070', fontSize: size ? '24px' : undefined }}>N/A</span>
};

export class ServiceHealth extends React.Component<Props, {}> {
  globalStatus: Status;
  info: string[];

  constructor(props: Props) {
    super(props);
    this.updateHealth(props.health);
  }

  componentWillReceiveProps(nextProps: Props) {
    this.updateHealth(nextProps.health);
  }

  ratioCheck(valid: number, total: number, errorMsg: string): Status {
    if (total === 0) {
      return NA;
    } else if (valid === 0) {
      this.info.push(errorMsg + 'failure');
      return FAILURE;
    } else if (valid === total) {
      return HEALTHY;
    }
    this.info.push(errorMsg + 'degraded');
    return DEGRADED;
  }

  mergeStatus(s1: Status, s2: Status): Status {
    return s1.priority > s2.priority ? s1 : s2;
  }

  updateHealth(health?: H.Health) {
    this.info = [];
    let countInactiveDeployments = 0;
    if (health) {
      const envoyStatus = this.ratioCheck(health.envoy.healthy, health.envoy.total, 'Envoy health ');
      this.globalStatus = health.deploymentStatuses.reduce((prev, cur) => {
        const status = this.ratioCheck(cur.available, cur.replicas, 'Pod deployment ');
        if (status === NA) {
          countInactiveDeployments++;
        }
        return this.mergeStatus(prev, status);
      }, envoyStatus);
    } else {
      this.globalStatus = NA;
    }
    if (health && countInactiveDeployments > 0 && countInactiveDeployments === health.deploymentStatuses.length) {
      // No active deployment => special case for failure
      this.globalStatus = FAILURE;
      this.info.push('No active deployment!');
    } else if (countInactiveDeployments === 1) {
      this.info.push('One inactive deployment');
    } else if (countInactiveDeployments > 1) {
      this.info.push(`${countInactiveDeployments} inactive deployments`);
    }
  }

  render() {
    if (this.props.health) {
      if (this.props.mode === DisplayMode.SMALL) {
        return this.renderSmall(this.props.health);
      } else {
        return this.renderLarge(this.props.health);
      }
    }
    return <span />;
  }

  renderSmall(health: H.Health) {
    const tooltip = this.info.length === 1 ? this.info[0] : this.info.map(str => '- ' + str).join('&#13;');
    return (
      <span>
        {this.globalStatus.jsx()}&nbsp;
        {tooltip && <Icon type="pf" name="info" title={tooltip} />}
      </span>
    );
  }

  renderLarge(health: H.Health) {
    return (
      <div>
        {this.globalStatus.jsx('35px')}
        <div style={{ color: this.globalStatus.color }}>{this.globalStatus.name}</div>
        {this.info.length === 1 && this.info[0]}
        {this.info.length > 1 && (
          <ul style={{ padding: 0 }}>{this.info.map((line, idx) => <li key={idx}>{line}</li>)}</ul>
        )}
      </div>
    );
  }
}

import * as React from 'react';
import * as H from '../../types/Health';
import { createIcon } from './Helper';
import { InfoAltIcon } from '@patternfly/react-icons';
import './Health.css';
import { PfColors } from '../Pf/PfColors';

interface Props {
  health: H.Health;
}

export class HealthDetails extends React.PureComponent<Props, {}> {
  renderErrorRate = (item: H.HealthItem, idx: number) => {
    const config = this.props.health.getStatusConfig();
    return (
      <div key={idx}>
        <strong>
          {' ' + item.title + (item.text && item.text.length > 0 ? ': ' : '')}{' '}
          {config && <InfoAltIcon color={PfColors.Gray} />}
        </strong>
        {item.text}
        {item.children && (
          <ul style={{ listStyleType: 'none', paddingLeft: 12 }}>
            {item.children.map((sub, subIdx) => {
              return (
                <li key={subIdx}>
                  {createIcon(sub.status)} {sub.text}
                </li>
              );
            })}
            {config && (
              <li key={'degraded_failure_config'}>
                {createIcon(H.DEGRADED)}: {config.degraded === 0 ? '>' : '>='}
                {config.degraded}% {createIcon(H.FAILURE)}: {config.degraded === 0 ? '>' : '>='}
                {config.failure}%
              </li>
            )}
          </ul>
        )}
      </div>
    );
  };

  renderChildren = (item: H.HealthItem, idx: number) => {
    return item.title.startsWith(H.TRAFFICSTATUS) ? (
      this.renderErrorRate(item, idx)
    ) : (
      <div key={idx}>
        <strong>{' ' + item.title + (item.text && item.text.length > 0 ? ': ' : '')}</strong>
        {item.text}
        {item.children && (
          <ul style={{ listStyleType: 'none', paddingLeft: 12 }}>
            {item.children.map((sub, subIdx) => {
              return (
                <li key={subIdx}>
                  {createIcon(sub.status)} {sub.text}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  render() {
    const health = this.props.health;
    return health.health.items.map((item, idx) => {
      return this.renderChildren(item, idx);
    });
  }
}

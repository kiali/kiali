import * as React from 'react';
import { Icon } from 'patternfly-react';
import * as H from '../../types/Health';

interface Props {
  health: H.Health;
}

export class HealthDetails extends React.PureComponent<Props, {}> {
  renderStatus(status: H.Status) {
    if (status.icon) {
      return <Icon type="pf" name={status.icon} />;
    } else {
      return <span style={{ color: status.color }}>{status.text}</span>;
    }
  }

  render() {
    const health = this.props.health;
    return health.items.map((item, idx) => {
      return (
        <div key={idx}>
          <strong>
            {this.renderStatus(item.status)}
            {' ' + item.title + ': '}
          </strong>
          {item.text}
          {item.children && (
            <ul style={{ listStyleType: 'none', paddingLeft: 12 }}>
              {item.children.map((sub, subIdx) => {
                return (
                  <li key={subIdx}>
                    {this.renderStatus(sub.status)} {sub.text}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    });
  }
}

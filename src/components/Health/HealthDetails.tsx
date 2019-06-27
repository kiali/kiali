import * as React from 'react';
import * as H from '../../types/Health';
import { createIcon } from './Helper';

import './Health.css';

interface Props {
  health: H.Health;
}

export class HealthDetails extends React.PureComponent<Props, {}> {
  render() {
    const health = this.props.health;
    return health.items.map((item, idx) => {
      return (
        <div key={idx}>
          <strong>
            {createIcon(item.status)}
            {' ' + item.title + ': '}
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
            </ul>
          )}
        </div>
      );
    });
  }
}

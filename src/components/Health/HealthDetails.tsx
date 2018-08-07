import * as React from 'react';
import { Icon, OverlayTrigger, Popover } from 'patternfly-react';
import * as H from '../../types/Health';

interface Props {
  id: string;
  health: H.Health;
  headline: string;
  placement?: string;
}

export class HealthDetails extends React.PureComponent<Props, {}> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <OverlayTrigger
        placement={this.props.placement || 'right'}
        overlay={this.renderPopover()}
        trigger={['hover', 'focus']}
        rootClose={false}
      >
        {this.props.children}
      </OverlayTrigger>
    );
  }

  renderStatus(status: H.Status) {
    if (status.icon) {
      return <Icon type="pf" name={status.icon} />;
    } else {
      return <span style={{ color: status.color }}>{status.text}</span>;
    }
  }

  renderPopover() {
    const health = this.props.health;
    return (
      <Popover id={this.props.id + '-health-tooltip'} title={this.props.headline}>
        {health.items.map((item, idx) => {
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
        })}
      </Popover>
    );
  }
}

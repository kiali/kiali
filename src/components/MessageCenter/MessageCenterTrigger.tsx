import * as React from 'react';
import * as PfReact from 'patternfly-react';

type PropsType = {
  newMessagesCount: number;
  systemErrorsCount: number;
  badgeDanger: boolean;
  toggleMessageCenter: () => void;
  toggleSystemErrorsCenter: () => void;
};

export default class MessageCenterTrigger extends React.PureComponent<PropsType, {}> {
  render() {
    return (
      <>
        {this.renderSystemErrorBadge()}
        {this.renderMessageCenterBadge()}
      </>
    );
  }

  private renderSystemErrorBadge = () => {
    if (this.props.systemErrorsCount === 0) {
      return null;
    }

    return (
      <li className="drawer-pf-trigger">
        <a className="nav-item-iconic" onClick={this.props.toggleSystemErrorsCenter}>
          <PfReact.Icon name="warning-triangle-o" type="pf" /> {this.props.systemErrorsCount}
          {this.props.systemErrorsCount === 1 ? ' Open Issue' : ' Open Issues'}
        </a>
      </li>
    );
  };

  private renderMessageCenterBadge = () => {
    return (
      <li className="drawer-pf-trigger">
        <a className="nav-item-iconic" onClick={this.props.toggleMessageCenter}>
          <PfReact.Icon name="bell" />
          {(this.props.systemErrorsCount > 0 || this.props.newMessagesCount > 0) && (
            <PfReact.Badge
              className={
                'pf-badge-bodered' + (this.props.badgeDanger || this.props.systemErrorsCount > 0 ? ' badge-danger' : '')
              }
            >
              {this.props.newMessagesCount > 0 ? this.props.newMessagesCount : ' '}
            </PfReact.Badge>
          )}
        </a>
      </li>
    );
  };
}

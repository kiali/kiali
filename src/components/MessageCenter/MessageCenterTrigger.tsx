import * as React from 'react';
import * as PfReact from 'patternfly-react';

type StateType = {};
type PropsType = {
  newMessagesCount: number;
  badgeDanger: boolean;
  toggleMessageCenter: () => void;
};

export default class MessageCenterTrigger extends React.PureComponent<PropsType, StateType> {
  render() {
    let icon;
    if (this.props.newMessagesCount > 0) {
      icon = (
        <div>
          <PfReact.Icon name="warning-triangle-o" type="pf" /> {this.props.newMessagesCount} open issues
        </div>
      );
    } else {
      icon = <PfReact.Icon name="bell" />;
    }
    return (
      <li className="drawer-pf-trigger">
        <a className="nav-item-iconic" onClick={this.props.toggleMessageCenter}>
          {icon}
        </a>
      </li>
    );
  }
}

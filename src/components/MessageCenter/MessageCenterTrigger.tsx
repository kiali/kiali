import * as React from 'react';
import * as PfReact from 'patternfly-react';

type StateType = {};
type PropsType = {
  newMessagesCount: number;
  toggleMessageCenter: () => void;
};

export default class MessageCenterTrigger extends React.PureComponent<PropsType, StateType> {
  render() {
    return (
      <li className="drawer-pf-trigger">
        <a className="nav-item-iconic" onClick={this.props.toggleMessageCenter}>
          <PfReact.Icon name="bell" />
          {this.props.newMessagesCount > 0 && (
            <PfReact.Badge className="pf-badge-bodered">{this.props.newMessagesCount}</PfReact.Badge>
          )}
        </a>
      </li>
    );
  }
}

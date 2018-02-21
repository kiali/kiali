import * as React from 'react';
import { Link } from 'react-router-dom';
import * as cx from 'classnames';

class Navigation extends React.Component {
  itemClass(href: string) {
    return cx({
      'list-group-item': true,
      active: window.location.pathname === href
    });
  }

  render() {
    return (
      <div className="nav-pf-vertical">
        <ul className="list-group">
          <li className={this.itemClass('/')}>
            <Link to="/">
              <span className="fa fa-dashboard" data-toggle="tooltip" title="Overview" />
              <span className="list-group-item-value">Overview</span>
            </Link>
          </li>
          <li className={this.itemClass('/service-graph')}>
            <Link to="/service-graph">
              <span className="fa fa-shield" data-toggle="tooltip" title="Graph" />
              <span className="list-group-item-value">Graph</span>
            </Link>
          </li>
          <li className={this.itemClass('/services')}>
            <Link to="/services">
              <span className="fa fa-users" data-toggle="tooltip" title="Services" />
              <span className="list-group-item-value">Services</span>
            </Link>
          </li>
        </ul>
      </div>
    );
  }
}

export default Navigation;

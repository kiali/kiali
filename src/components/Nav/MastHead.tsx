import * as React from 'react';
import { Navbar } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const pfLogo = require('../../img/logo-alt.svg');
const pfBrand = require('../../img/brand-alt.svg');

class MastHead extends React.Component {
  render() {
    return (
      <Navbar fluid={true} collapseOnSelect={true} className="navbar navbar-pf-vertical">
        <Navbar.Header>
          <Navbar.Toggle />
          <Navbar.Brand>
            <Link to="/">
              <img className="navbar-brand-icon" src={pfLogo} alt="" />
              <img className="navbar-brand-name" src={pfBrand} alt="PatternFly Enterprise Application" />
            </Link>
          </Navbar.Brand>
        </Navbar.Header>
      </Navbar>
    );
  }
}

export default MastHead;

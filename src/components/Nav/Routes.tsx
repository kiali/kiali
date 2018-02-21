import * as React from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';

import HomePage from '../../pages/Home/HomePage';
import ServiceGraphPage from '../../pages/ServiceGraph/ServiceGraphPage';
import ServiceDetailsPage from '../../pages/ServiceDetails/ServiceDetailsPage';
import ServiceListPage from '../../pages/ServiceList/ServiceListPage';

class Routes extends React.Component {
  render() {
    return (
      <Switch>
        <Route path="/service-graph" component={ServiceGraphPage} />
        <Route path="/services" component={ServiceListPage} />
        <Route path="/namespaces/:namespace/services/:service" component={ServiceDetailsPage} />
        <Route path="/" exact={true} component={HomePage} />
        <Redirect to="/" />
      </Switch>
    );
  }
}

export default Routes;

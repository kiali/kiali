import * as React from 'react';
import './App.css';

import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom';

import ServiceGraphPage from './pages/ServiceGraph/ServiceGraphPage';
import ServiceDetailsPage from './pages/ServiceDetails/ServiceDetailsPage';
import ServiceListPage from './pages/ServiceList/ServiceListPage';
import HomePage from './pages/Home/HomePage';

const logo = require('./logo.svg');

class App extends React.Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Swift Sunshine</h1>
        </header>
        <BrowserRouter>
          <Switch>
            <Route path="/service-graph" component={ServiceGraphPage} />
            <Route path="/services" component={ServiceListPage} />
            <Route path="/namespaces/:namespace/services/:service" component={ServiceDetailsPage} />
            <Route path="/" exact={true} component={HomePage} />
            <Redirect to="/" />
          </Switch>
        </BrowserRouter>
      </div>
    );
  }
}

export default App;

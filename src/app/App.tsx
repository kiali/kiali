import * as React from 'react';
import { BrowserRouter, withRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import './App.css';
import Navigation from '../components/Nav/Navigation';
import store from '../store/ConfigStore';

class App extends React.Component {
  render() {
    const Sidebar = withRouter(Navigation);
    return (
      <Provider store={store}>
        <BrowserRouter basename="/console">
          <Sidebar />
        </BrowserRouter>
      </Provider>
    );
  }
}

export default App;

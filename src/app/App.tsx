import * as React from 'react';
import './App.css';
import Navigation from '../components/Nav/Navigation';
import { BrowserRouter, withRouter } from 'react-router-dom';

class App extends React.Component {
  render() {
    const Sidebar = withRouter(Navigation);
    return (
      <BrowserRouter basename="/console">
        <div>
          <Sidebar />
        </div>
      </BrowserRouter>
    );
  }
}

export default App;

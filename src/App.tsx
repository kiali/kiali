import * as React from 'react';
import './css/App.css';
import Navigation from './components/Nav/Navigation';
import { BrowserRouter } from 'react-router-dom';
import MastHead from './components/Nav/MastHead';
import Routes from './components/Nav/Routes';

class App extends React.Component {
  render() {
    return (
      <BrowserRouter>
        <div>
          <MastHead />
          <Navigation />
          <Routes />
        </div>
      </BrowserRouter>
    );
  }
}

export default App;

import * as React from 'react';
import './App.css';
import Navigation from '../components/Nav/Navigation';
import { BrowserRouter } from 'react-router-dom';

class App extends React.Component {
  render() {
    return (
      <BrowserRouter>
        <div>
          <Navigation />
        </div>
      </BrowserRouter>
    );
  }
}

export default App;

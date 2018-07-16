import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import SwitchErrorBoundary from '../SwitchErrorBoundary/SwitchErrorBoundary';
import { pathRoutes, defaultRoute } from '../../routes';
import PfContainerNavVertical from '../Pf/PfContainerNavVertical';

class RenderPage extends React.Component {
  renderPaths() {
    return pathRoutes.map((item, index) => {
      return <Route key={index} path={item.path} component={item.component} />;
    });
  }

  render() {
    return (
      <PfContainerNavVertical>
        <SwitchErrorBoundary
          fallBackComponent={() => <h2>Sorry, there was a problem. Try a refresh or navigate to a different page.</h2>}
        >
          {this.renderPaths()}
          <Redirect from="/" to={defaultRoute} />
        </SwitchErrorBoundary>
      </PfContainerNavVertical>
    );
  }
}

export default RenderPage;

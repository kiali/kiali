import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import SwitchErrorBoundary from '../SwitchErrorBoundary/SwitchErrorBoundary';
import { pathRoutes, defaultRoute, secondaryMastheadRoutes } from '../../routes';
import PfContainerNavVertical from '../Pf/PfContainerNavVertical';
import { Path } from '../../types/Routes';

class RenderPage extends React.Component {
  renderPaths(paths: Path[]) {
    return paths.map((item, index) => {
      return <Route key={index} path={item.path} component={item.component} />;
    });
  }

  renderPathRoutes() {
    return this.renderPaths(pathRoutes);
  }

  renderSecondaryMastheadRoutes() {
    return this.renderPaths(secondaryMastheadRoutes);
  }

  render() {
    return (
      <PfContainerNavVertical>
        <div>{this.renderSecondaryMastheadRoutes()}</div>
        <div className="container-fluid">
          <SwitchErrorBoundary
            fallBackComponent={() => (
              <h2>Sorry, there was a problem. Try a refresh or navigate to a different page.</h2>
            )}
          >
            {this.renderPathRoutes()}
            <Redirect from="/" to={defaultRoute} />
          </SwitchErrorBoundary>
        </div>
      </PfContainerNavVertical>
    );
  }
}

export default RenderPage;

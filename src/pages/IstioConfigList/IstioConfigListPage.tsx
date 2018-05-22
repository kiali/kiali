import * as React from 'react';
import IstioConfigListComponent from './IstioConfigListComponent';
import * as MessageCenter from '../../utils/MessageCenter';

type IstioConfigListState = {};

type IstioConfigListProps = {
  // none yet
};

class IstioConfigListPage extends React.Component<IstioConfigListProps, IstioConfigListState> {
  handleError = (error: string) => {
    MessageCenter.add(error);
  };

  render() {
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
        <h2>Istio Config</h2>
        <IstioConfigListComponent onError={this.handleError} />
      </div>
    );
  }
}

export default IstioConfigListPage;

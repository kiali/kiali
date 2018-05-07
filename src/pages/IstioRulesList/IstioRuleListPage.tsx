import * as React from 'react';
import IstioRuleListComponent from './IstioRuleListComponent';
import * as MessageCenter from '../../utils/MessageCenter';

type IstioRuleListState = {};

type IstioRuleListProps = {
  // none yet
};

class IstioRuleListPage extends React.Component<IstioRuleListProps, IstioRuleListState> {
  handleError = (error: string) => {
    MessageCenter.add(error);
  };

  render() {
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
        <h2>Istio Mixer Rules</h2>
        <IstioRuleListComponent onError={this.handleError} />
      </div>
    );
  }
}

export default IstioRuleListPage;

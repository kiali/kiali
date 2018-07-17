import * as React from 'react';
import IstioConfigListComponent from './IstioConfigListComponent';
import * as MessageCenter from '../../utils/MessageCenter';
import { Breadcrumb } from 'patternfly-react';

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
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Istio Config</Breadcrumb.Item>
        </Breadcrumb>
        <IstioConfigListComponent onError={this.handleError} />
      </>
    );
  }
}

export default IstioConfigListPage;

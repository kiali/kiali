import * as React from 'react';
import IstioConfigListLink from './IstioConfigListLink';

interface Props {
  namespace: string;
  errors: number;
  warnings: number;
  objectCount?: number;
}

class ValidationSummaryLink extends React.PureComponent<Props> {
  hasIstioObjects = () => {
    return this.props.objectCount && this.props.objectCount > 0;
  };

  render() {
    let link: any = <div style={{ display: 'inline-block', marginLeft: '5px' }}>N/A</div>;

    if (this.hasIstioObjects()) {
      link = (
        <IstioConfigListLink
          namespaces={[this.props.namespace]}
          warnings={this.props.warnings > 0}
          errors={this.props.errors > 0}
        >
          {this.props.children}
        </IstioConfigListLink>
      );
    }

    return link;
  }
}

export default ValidationSummaryLink;

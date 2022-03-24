import * as React from 'react';
import { Link } from 'react-router-dom';
import { Paths } from '../../config';
import { FilterSelected } from '../Filters/StatefulFilters';

interface Props {
  namespaces: string[];
  errors?: boolean;
  warnings?: boolean;
}

class IstioConfigListLink extends React.Component<Props> {
  namespacesToParams = () => {
    let param: string = '';
    if (this.props.namespaces.length > 0) {
      param = 'namespaces=' + this.props.namespaces.join(',');
    }
    return param;
  };

  validationToParams = () => {
    let params: string = '';

    if (this.props.warnings) {
      params += 'configvalidation=Warning';
    }

    let errorParams: string = '';
    if (this.props.errors) {
      errorParams += 'configvalidation=Not+Valid';
    }

    if (params !== '' && errorParams !== '') {
      params += '&';
    }

    params += errorParams;

    return params;
  };

  cleanFilters = () => {
    FilterSelected.resetFilters();
  };

  render() {
    let params: string = this.namespacesToParams();
    const validationParams: string = this.validationToParams();
    if (params !== '' && validationParams !== '') {
      params += '&';
    }
    params += validationParams;

    return (
      <Link to={`/${Paths.ISTIO}?${params}`} onClick={this.cleanFilters}>
        {this.props.children}
      </Link>
    );
  }
}

export default IstioConfigListLink;

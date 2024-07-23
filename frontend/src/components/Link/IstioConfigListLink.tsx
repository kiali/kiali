import * as React from 'react';
import { Paths } from '../../config';
import { FilterSelected } from '../Filters/StatefulFilters';
import { Link } from 'react-router-dom-v5-compat';

interface Props {
  children: React.ReactNode;
  errors?: boolean;
  namespaces: string[];
  warnings?: boolean;
}

export const IstioConfigListLink: React.FC<Props> = (props: Props) => {
  const namespacesToParams = (): string => {
    let param = '';

    if (props.namespaces.length > 0) {
      param = `namespaces=${props.namespaces.join(',')}`;
    }

    return param;
  };

  const validationToParams = (): string => {
    let params = '';

    if (props.warnings) {
      params += 'configvalidation=Warning';
    }

    let errorParams = '';

    if (props.errors) {
      errorParams += 'configvalidation=Not+Valid';
    }

    if (params !== '' && errorParams !== '') {
      params += '&';
    }

    params += errorParams;

    return params;
  };

  const cleanFilters = (): void => {
    FilterSelected.resetFilters();
  };

  let params: string = namespacesToParams();

  const validationParams: string = validationToParams();

  if (params !== '' && validationParams !== '') {
    params += '&';
  }

  params += validationParams;

  return (
    <Link to={`/${Paths.ISTIO}?${params}`} onClick={cleanFilters}>
      {props.children}
    </Link>
  );
};

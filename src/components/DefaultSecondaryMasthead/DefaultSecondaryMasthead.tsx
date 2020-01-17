import React from 'react';
import { Title } from '@patternfly/react-core';
import SecondaryMasthead from '../Nav/SecondaryMasthead';
import NamespaceDropdownContainer from '../NamespaceDropdown';

const titleShow = ['applications', 'workloads', 'services', 'istio'];
export default class DefaultSecondaryMasthead extends React.Component {
  showTitle() {
    const path = window.location.pathname.replace('/console/', '');

    if (titleShow.includes(path)) {
      return (
        <Title headingLevel="h1" size="4xl" style={{ margin: '20px 0 20px' }}>
          {path.charAt(0).toUpperCase() + path.slice(1)}
        </Title>
      );
    }

    return undefined;
  }

  render() {
    const title = this.showTitle();

    return (
      <SecondaryMasthead title={title ? true : false}>
        <NamespaceDropdownContainer disabled={false} />
        {title}
      </SecondaryMasthead>
    );
  }
}

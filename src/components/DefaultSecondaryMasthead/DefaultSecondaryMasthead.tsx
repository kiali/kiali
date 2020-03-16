import React from 'react';
import { Title } from '@patternfly/react-core';
import SecondaryMasthead from '../Nav/SecondaryMasthead';
import NamespaceDropdownContainer from '../NamespaceDropdown';

const titles = ['applications', 'workloads', 'services', 'istio', 'istio/new'];
export default class DefaultSecondaryMasthead extends React.Component {
  showTitle() {
    const path = window.location.pathname.replace('/console/', '');

    if (titles.includes(path)) {
      let title = path.charAt(0).toUpperCase() + path.slice(1);
      if (path === 'istio/new') {
        title = 'Create New Istio Config';
      } else if (path === 'istio') {
        title = 'Istio Config';
      }
      return (
        <Title headingLevel="h1" size="4xl" style={{ margin: '20px 0 20px' }}>
          {title}
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

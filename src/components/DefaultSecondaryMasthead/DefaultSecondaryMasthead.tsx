import React from 'react';
import { Title } from '@patternfly/react-core';
import SecondaryMasthead from '../Nav/SecondaryMasthead';
import NamespaceDropdownContainer from '../NamespaceDropdown';

const titles = [
  'applications',
  'workloads',
  'services',
  'istio',
  'istio/new',
  'extensions/threescale/new',
  'extensions/iter8',
  'extensions/iter8/new'
];
export default class DefaultSecondaryMasthead extends React.Component {
  showTitle() {
    let path = window.location.pathname;
    path = path.substr(path.lastIndexOf('/console') + '/console'.length + 1);
    if (titles.includes(path)) {
      let title = path.charAt(0).toUpperCase() + path.slice(1);
      let disabled = false;
      if (path === 'istio/new') {
        title = 'Create New Istio Config';
      } else if (path === 'istio') {
        title = 'Istio Config';
      } else if (path === 'extensions/threescale/new') {
        title = 'Create New 3scale Config';
      } else if (path === 'extensions/iter8') {
        title = 'Iter8 Experiments';
      } else if (path === 'extensions/iter8/new') {
        title = 'Create New Iter8 Experiment';
        disabled = true;
      }
      return {
        title: (
          <Title headingLevel="h1" size="3xl" style={{ margin: '18px 0 18px' }}>
            {title}
          </Title>
        ),
        disabled: disabled
      };
    }

    return { title: undefined, disabled: false };
  }

  render() {
    const { title, disabled } = this.showTitle();
    return (
      <SecondaryMasthead title={title ? true : false}>
        <NamespaceDropdownContainer disabled={disabled} />
        {title}
      </SecondaryMasthead>
    );
  }
}

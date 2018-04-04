import '../../app/App.css';

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import NamespaceFilter from './NamespaceFilter';

const stories = storiesOf('NamespaceFilter', module);

const mockNamespaces = () => {
  const mock = new MockAdapter(axios);
  mock
    .onAny()
    .reply(200, [
      { name: 'bookinfo' },
      { name: 'default' },
      { name: 'istio-system' },
      { name: 'kube-public' },
      { name: 'kube-system' }
    ]);
  return mock;
};

stories.add('NamespaceFilter', () => {
  mockNamespaces();
  return <NamespaceFilter onFilterChange={action('onFilterChange')} onError={action('onError')} initialFilters={[]} />;
});

stories.add('Fails to load namespaces', () => {
  return <NamespaceFilter onFilterChange={action('onFilterChange')} onError={action('onError')} initialFilters={[]} />;
});

stories.add('Custom select filter', () => {
  mockNamespaces();
  return (
    <NamespaceFilter
      onFilterChange={action('onFilterChange')}
      onError={action('onError')}
      initialFilters={[
        {
          id: 'dummy-id',
          title: 'Custom filter',
          placeholder: 'Select a custom filter',
          filterType: 'select',
          filterValues: [
            { id: 'red', title: 'Red custom filter' },
            { id: 'green', title: 'Green custom filter' },
            { id: 'blue', title: 'Blue custom filter' }
          ]
        }
      ]}
    />
  );
});

stories.add('Custom open filter', () => {
  mockNamespaces();
  return (
    <NamespaceFilter
      onFilterChange={action('onFilterChange')}
      onError={action('onError')}
      initialFilters={[
        {
          id: 'dummy-id',
          title: 'Custom filter',
          placeholder: 'Write your custom filter',
          filterType: '',
          filterValues: []
        }
      ]}
    />
  );
});

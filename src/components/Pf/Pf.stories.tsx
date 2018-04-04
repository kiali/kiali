import '../../app/App.css';

import * as React from 'react';
import { storiesOf } from '@storybook/react';

import PFHeader from './PfHeader';
import PFContainerNavVertical from './PfContainerNavVertical';

const stories = storiesOf('Pf', module);

stories.add('PFContainerNavVertical', () => (
  <PFContainerNavVertical>
    <div>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
      magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
      consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
      Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum
    </div>
  </PFContainerNavVertical>
));

stories.add('PFHeader', () => (
  <PFContainerNavVertical>
    <PFHeader>
      <h2> Awesome header </h2>
    </PFHeader>
    <div>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
      magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
      consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
      Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum
    </div>
  </PFContainerNavVertical>
));

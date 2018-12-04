import React from 'react';

import SecondaryMasthead from '../Nav/SecondaryMasthead';
import NamespaceDropdownContainer from '../../components/NamespaceDropdown';

export default class DefaultSecondaryMasthead extends React.PureComponent {
  render() {
    return (
      <SecondaryMasthead>
        <NamespaceDropdownContainer disabled={false} />
      </SecondaryMasthead>
    );
  }
}

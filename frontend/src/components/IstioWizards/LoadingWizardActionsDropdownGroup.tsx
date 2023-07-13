import { DropdownGroup, DropdownItem, Spinner } from '@patternfly/react-core';
import * as React from 'react';
import { groupMenuStyle } from 'styles/DropdownStyles';

export function LoadingWizardActionsDropdownGroup() {
  return (
    <DropdownGroup key="wizards" label="Actions" className={groupMenuStyle}>
      <DropdownItem isDisabled={true}>
        <Spinner isSVG={true} size="md" aria-label="Loading actions..." />
      </DropdownItem>
    </DropdownGroup>
  );
}

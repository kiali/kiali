import { Spinner } from '@patternfly/react-core';
import { DropdownGroup, DropdownItem } from '@patternfly/react-core/deprecated';
import * as React from 'react';
import { groupMenuStyle } from 'styles/DropdownStyles';

export function LoadingWizardActionsDropdownGroup() {
  return (
    <DropdownGroup key="wizards" label="Actions" className={groupMenuStyle}>
      <DropdownItem isDisabled={true}>
        <Spinner size="md" aria-label="Loading actions..." />
      </DropdownItem>
    </DropdownGroup>
  );
}

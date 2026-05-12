import { Spinner } from '@patternfly/react-core';
import { DropdownGroup, DropdownItem } from '@patternfly/react-core';
import { groupMenuStyle } from 'styles/DropdownStyles';

export const LoadingWizardActionsDropdownGroup = (): JSX.Element => {
  return (
    <DropdownGroup key="wizards" label="Actions" className={groupMenuStyle}>
      <DropdownItem isDisabled={true}>
        <Spinner size="md" aria-label="Loading actions..." />
      </DropdownItem>
    </DropdownGroup>
  );
};

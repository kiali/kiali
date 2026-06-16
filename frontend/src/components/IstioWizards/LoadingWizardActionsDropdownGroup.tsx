import { DropdownGroup, DropdownItem, Spinner } from '@patternfly/react-core';
import { groupMenuStyle } from 'styles/DropdownStyles';
import { t } from 'utils/I18nUtils';

export const LoadingWizardActionsDropdownGroup = (): JSX.Element => {
  return (
    <DropdownGroup key="wizards" label={t('Actions')} className={groupMenuStyle}>
      <DropdownItem isDisabled={true}>
        <Spinner size="md" aria-label={t('Loading actions...')} />
      </DropdownItem>
    </DropdownGroup>
  );
};

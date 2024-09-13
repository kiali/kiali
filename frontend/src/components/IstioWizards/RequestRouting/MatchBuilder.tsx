import * as React from 'react';
import {
  Button,
  InputGroup,
  TextInput,
  ButtonVariant,
  InputGroupItem,
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggleElement,
  MenuToggle
} from '@patternfly/react-core';
import { t } from 'utils/I18nUtils';

type MatchBuilderProps = {
  category: string;
  headerName: string;
  isValid: boolean;
  matchValue: string;
  onAddMatch: () => void;
  onHeaderNameChange: (value: string) => void;
  onMatchValueChange: (value: string) => void;
  onSelectCategory: (category: string) => void;
  onSelectOperator: (operator: string) => void;
  operator: string;
};

export const HEADERS = 'headers';
export const URI = 'uri';
export const SCHEME = 'scheme';
export const METHOD = 'method';
export const AUTHORITY = 'authority';

const matchOptions: string[] = [HEADERS, URI, SCHEME, METHOD, AUTHORITY];

export const EXACT = 'exact';
export const PREFIX = 'prefix';
export const REGEX = 'regex';

// Pseudo operator
export const PRESENCE = 'presents';
export const ANYTHING = '{}';

const opOptions: string[] = [EXACT, PREFIX, REGEX];

const placeholderText = {
  [HEADERS]: 'Header value...',
  [URI]: 'Uri value...',
  [SCHEME]: 'Scheme value...',
  [METHOD]: 'Method value...',
  [AUTHORITY]: 'Authority value...'
};

export const MatchBuilder: React.FC<MatchBuilderProps> = (props: MatchBuilderProps) => {
  const [isMatchDropdown, setIsMatchDropdown] = React.useState<boolean>(false);
  const [isOperatorDropdown, setIsOperatorDropdown] = React.useState<boolean>(false);
  const renderOpOptions: string[] = props.category === HEADERS ? [PRESENCE, ...opOptions] : opOptions;

  return (
    <InputGroup>
      <InputGroupItem>
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsMatchDropdown(!isMatchDropdown)}
              data-test={'requestmatching-header-toggle'}
              isExpanded={isMatchDropdown}
            >
              {props.category}
            </MenuToggle>
          )}
          isOpen={isMatchDropdown}
          onOpenChange={(isOpen: boolean) => setIsMatchDropdown(isOpen)}
        >
          <DropdownList>
            {matchOptions.map((mode, index) => (
              <DropdownItem
                key={`${mode}_${index}`}
                value={mode}
                component="button"
                onClick={() => {
                  props.onSelectCategory(mode);
                  setIsMatchDropdown(!isMatchDropdown);
                }}
                data-test={`requestmatching-header-${mode}`}
              >
                {mode}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      </InputGroupItem>

      {props.category === HEADERS && (
        <TextInput
          id="header-name-id"
          value={props.headerName}
          onChange={(_, value) => props.onHeaderNameChange(value)}
          placeholder="Header name..."
        />
      )}

      <InputGroupItem>
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsOperatorDropdown(!isOperatorDropdown)}
              data-test={'requestmatching-match-toggle'}
              isExpanded={isOperatorDropdown}
            >
              {props.operator}
            </MenuToggle>
          )}
          isOpen={isOperatorDropdown}
          onOpenChange={(isOpen: boolean) => setIsOperatorDropdown(isOpen)}
        >
          <DropdownList>
            {renderOpOptions.map((op, index) => (
              <DropdownItem
                key={`${op}_${index}`}
                value={op}
                component="button"
                onClick={() => {
                  props.onSelectOperator(op);
                  setIsOperatorDropdown(!isOperatorDropdown);
                }}
                data-test={`requestmatching-match-${op}`}
              >
                {op}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      </InputGroupItem>

      {props.operator !== PRESENCE && (
        <TextInput
          id="match-value-id"
          value={props.matchValue}
          onChange={(_, value) => props.onMatchValueChange(value)}
          placeholder={placeholderText[props.category]}
        />
      )}

      <InputGroupItem>
        <Button
          variant={ButtonVariant.secondary}
          isDisabled={!props.isValid}
          onClick={props.onAddMatch}
          data-test="add-match"
        >
          {t('Add Match')}
        </Button>
      </InputGroupItem>
    </InputGroup>
  );
};

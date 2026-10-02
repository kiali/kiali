import * as React from 'react';
import { serverConfig } from 'config';
import { kialiStyle } from 'styles/StyleUtils';
import type { MenuToggleElement } from '@patternfly/react-core';
import { Dropdown, DropdownItem, DropdownList, MenuToggle } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';

type FindKind = 'find' | 'hide';

type MeshFindOptionsProps = {
  kind: FindKind;
  onSelect: (expression: string) => void;
};

const menuToggleStyle = kialiStyle({
  paddingLeft: '0.75rem',
  paddingRight: '0.75rem',
  marginLeft: '0.125rem'
});

export const MeshFindOptions: React.FC<MeshFindOptionsProps> = (props: MeshFindOptionsProps) => {
  const { kind, onSelect } = props;
  const { t } = useKialiTranslation();
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const presetOptions =
    kind === 'find'
      ? serverConfig.kialiFeatureFlags.uiDefaults.mesh.findOptions
      : serverConfig.kialiFeatureFlags.uiDefaults.mesh.hideOptions;

  const onToggle = (isOpen: boolean): void => {
    setIsOpen(isOpen);
  };

  return (
    <Dropdown
      key={`mesh-${kind}-presets`}
      id={`mesh-${kind}-presets`}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          className={menuToggleStyle}
          data-test={`${kind}-options-dropdown`}
          onClick={() => onToggle(!isOpen)}
          isExpanded={isOpen}
        />
      )}
      isOpen={isOpen}
      onOpenChange={(isOpen: boolean) => onToggle(isOpen)}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>
        {presetOptions.map(o => (
          <DropdownItem key={o.description} onClick={() => onSelect(o.expression)}>
            {t(o.description)}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

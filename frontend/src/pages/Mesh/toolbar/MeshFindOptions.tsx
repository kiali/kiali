import * as React from 'react';
import { serverConfig } from 'config';
import { kialiStyle } from 'styles/StyleUtils';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';

type FindKind = 'find' | 'hide';

type MeshFindOptionsProps = {
  kind: FindKind;
  onSelect: (expression: string) => void;
};

const menuToggleStyle = kialiStyle({
  paddingRight: 0,
  $nest: {
    '& .pf-v6-c-menu-toggle__controls': {
      paddingLeft: 0
    }
  }
});

export const MeshFindOptions: React.FC<MeshFindOptionsProps> = (props: MeshFindOptionsProps) => {
  const { kind, onSelect } = props;
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const [options, setOptions] = React.useState<React.ReactNode[]>([]);

  React.useEffect(() => {
    const getOptionItems = (kind: FindKind): React.ReactFragment[] => {
      const options =
        kind === 'find'
          ? serverConfig.kialiFeatureFlags.uiDefaults.mesh.findOptions
          : serverConfig.kialiFeatureFlags.uiDefaults.mesh.hideOptions;
      return options.map(o => {
        return (
          <DropdownItem key={o.description} onClick={() => onSelect(o.expression)}>
            {o.description}
          </DropdownItem>
        );
      });
    };

    setOptions(getOptionItems(kind));
  }, [kind, onSelect]);

  const onToggle = (isOpen: boolean) => {
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
      <DropdownList>{options}</DropdownList>
    </Dropdown>
  );
};

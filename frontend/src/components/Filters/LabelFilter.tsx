import * as React from 'react';
import { Button, ButtonVariant, Popover, PopoverPosition, TextInput } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';

interface LabelFiltersProps {
  filterAdd: (value: string) => void;
  isActive: (value: string) => boolean;
  onChange: (value: any) => void;
  value: string;
}

const infoIconStyle = kialiStyle({
  marginLeft: '0.5rem',
  alignSelf: 'center'
});

export const LabelFilters: React.FC<LabelFiltersProps> = (props: LabelFiltersProps) => {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (props.value && props.value.length > 0) {
        props.value.split(' ').map(val => !props.isActive(val) && props.filterAdd(val));
      }
    }
  };

  return (
    <>
      <TextInput
        type="text"
        value={props.value}
        aria-label="filter_input_label_key"
        placeholder="Set Label"
        onChange={(_event, value) => props.onChange(value)}
        onKeyDown={e => onKeyDown(e)}
        style={{ width: 'auto' }}
      />

      <Popover
        headerContent={<span>Label Filter Help</span>}
        position={PopoverPosition.right}
        bodyContent={
          <>
            To set a label filter you must enter values like.
            <br />
            <ul style={{ listStyleType: 'circle', marginLeft: '1.25rem' }}>
              <li>Filter by label presence: label</li>
              <li>Filter by label and value: label=value</li>
              <li>
                Filter by more than one label and one or more values:
                <br />
                label=value label2=value2,value2-2
                <br />
                (separate with ' ')
              </li>
            </ul>
          </>
        }
      >
        <Button variant={ButtonVariant.link} className={infoIconStyle} isInline>
          <KialiIcon.Help />
        </Button>
      </Popover>
    </>
  );
};

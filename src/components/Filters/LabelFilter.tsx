import * as React from 'react';
import { Button, ButtonVariant, Popover, PopoverPosition, TextInput } from '@patternfly/react-core';
import { defaultIconStyle, KialiIcon } from '../../config/KialiIcon';

interface LabelFiltersProps {
  onChange: (value: any) => void;
  value: string;
  filterAdd: (value: string) => void;
  duplicatesFilter: (value: string) => boolean;
}

export class LabelFilters extends React.Component<LabelFiltersProps> {
  onkeyPress = (e: any) => {
    if (e.key === 'Enter') {
      if (this.props.value && this.props.value.length > 0) {
        this.props.value.split(' ').map(val => !this.props.duplicatesFilter(val) && this.props.filterAdd(val));
      }
    }
  };

  render() {
    return (
      <>
        <TextInput
          type={'text'}
          value={this.props.value}
          aria-label={'filter_input_label_key'}
          placeholder={'Set Label'}
          onChange={value => this.props.onChange(value)}
          onKeyPress={e => this.onkeyPress(e)}
          style={{ width: 'auto' }}
        />
        <Popover
          headerContent={<span>Label Filter Help</span>}
          bodyContent={
            <>
              To set a label filter you must enter values like.
              <br />
              <ul style={{ listStyleType: 'circle', marginLeft: '20px' }}>
                <li>Filter by label presence: label</li>
                <li>Filter by label and value: label=value</li>
                <li>
                  Filter by more than one label and one or more values: label=value label2=value2,value2-2 (separate
                  with ' ')
                </li>
              </ul>
            </>
          }
          position={PopoverPosition.bottom}
        >
          <Button variant={ButtonVariant.link} style={{ paddingLeft: '6px' }}>
            <KialiIcon.Help className={defaultIconStyle} />
          </Button>
        </Popover>
      </>
    );
  }
}

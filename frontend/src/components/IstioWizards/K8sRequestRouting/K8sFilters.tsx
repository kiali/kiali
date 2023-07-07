import * as React from 'react';
import { Chip } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { FILTERING_SELECTED_TOOLTIP, wizardTooltip } from '../WizardHelp';

type Props = {
  filters: string[];
  onRemoveFilter: (filter: string) => void;
};

const labelContainerStyle = kialiStyle({
  marginTop: 20,
  height: 40
});

const remove = kialiStyle({
  cursor: 'not-allowed'
});

export class K8sFilters extends React.Component<Props> {
  render() {
    const filters: any[] = this.props.filters.map((filter, index) => (
      <span key={filter + '-' + index} data-test={filter} className={remove}>
        <Chip onClick={() => this.props.onRemoveFilter(filter)} isOverflowChip={true}>
          {filter}
        </Chip>{' '}
      </span>
    ));
    return (
      <div className={labelContainerStyle}>
        <span
          style={{
            marginRight: '32px'
          }}
        >
          Filtering selected
          {wizardTooltip(FILTERING_SELECTED_TOOLTIP)}
        </span>
        {filters.length > 0 ? filters : <b>No Request Filter</b>}
      </div>
    );
  }
}

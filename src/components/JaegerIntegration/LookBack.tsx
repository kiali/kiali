import * as React from 'react';
import { FormSelect, FormSelectOption } from '@patternfly/react-core';
import { config, serverConfig } from '../../config';
import { style } from 'typestyle';

interface LookBackProps {
  disabled?: boolean;
  lookback?: number;
  setLookback: (value: string, event: any) => void;
}

const lookbackDropdown = style({ marginLeft: '-80px' });

export class LookBack extends React.PureComponent<LookBackProps> {
  lookBackOptions = { ...serverConfig.durations, ...{ 0: 'Custom Time Range' } };
  lookbackDefault = config.toolbar.defaultDuration;

  componentDidMount() {
    this.props.setLookback(String(this.props.lookback), null);
  }

  render() {
    const { lookback, setLookback } = this.props;
    const options: any[] = [];
    for (const [key, value] of Object.entries(this.lookBackOptions)) {
      options.push({ value: key, label: value, disabled: false });
    }

    return (
      <>
        <FormSelect
          value={lookback !== undefined ? lookback : this.lookbackDefault}
          onChange={setLookback}
          aria-label="FormSelect lookback"
          className={lookbackDropdown}
        >
          {options.map((option, index) => (
            <FormSelectOption isDisabled={option.disabled} key={index} value={option.value} label={option.label} />
          ))}
        </FormSelect>
      </>
    );
  }
}

export default LookBack;

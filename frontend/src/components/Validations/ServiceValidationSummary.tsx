import * as React from 'react';
import { Text, TextVariants } from '@patternfly/react-core';
import { ValidationSummary } from './ValidationSummary';
import { kialiStyle } from 'styles/StyleUtils';

const tooltipListStyle = kialiStyle({
  textAlign: 'left',
  border: 0,
  padding: '0 0 0 0',
  margin: '0 0 0 0'
});

export class ServiceValidationSummary extends ValidationSummary {
  tooltipSummary() {
    return (
      <>
        <Text style={{ textAlign: 'left', textEmphasis: 'strong' }} component={TextVariants.p}>
          {$t('Service_validation_result', 'Service validation result')}
        </Text>
        <div className={tooltipListStyle}>
          {this.severitySummary().map(cat => (
            <div key={cat}>{cat}</div>
          ))}
        </div>
      </>
    );
  }

  tooltipContent() {
    return this.tooltipSummary();
  }
}

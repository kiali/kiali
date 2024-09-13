import * as React from 'react';
import { Chip } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { MATCHING_SELECTED_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { t } from 'utils/I18nUtils';

type Props = {
  matches: string[];
  onRemoveMatch: (match: string) => void;
};

const labelContainerStyle = kialiStyle({
  marginTop: 20,
  height: 40
});

const remove = kialiStyle({
  cursor: 'not-allowed'
});

export class Matches extends React.Component<Props> {
  render() {
    const matches: any[] = this.props.matches.map((match, index) => (
      <span key={match + '-' + index} data-test={match} className={remove}>
        <Chip onClick={() => this.props.onRemoveMatch(match)} isOverflowChip={true}>
          {match}
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
          {t('Matching selected')}
          {wizardTooltip(MATCHING_SELECTED_TOOLTIP)}
        </span>
        {matches.length > 0 ? matches : <b>{t('Match any request')}</b>}
      </div>
    );
  }
}

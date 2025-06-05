import * as React from 'react';
import { Label } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { MATCHING_SELECTED_TOOLTIP, wizardTooltip } from '../WizardHelp';

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

export class K8sMatches extends React.Component<Props> {
  render() {
    const matches: any[] = this.props.matches.map((match, index) => (
      <span key={match + '-' + index} data-test={match} className={remove}>
        <Label onClick={() => this.props.onRemoveMatch(match)} variant={'overflow'}>
          {match}
        </Label>{' '}
      </span>
    ));
    return (
      <div className={labelContainerStyle}>
        <span
          style={{
            marginRight: '32px'
          }}
        >
          Matching selected
          {wizardTooltip(MATCHING_SELECTED_TOOLTIP)}
        </span>
        {matches.length > 0 ? matches : <b>Match any request</b>}
      </div>
    );
  }
}

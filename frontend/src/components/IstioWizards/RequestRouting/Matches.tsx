import * as React from 'react';
import { Chip } from '@patternfly/react-core';
import { style } from 'typestyle';
import { MATCHING_SELECTED_TOOLTIP, wizardTooltip } from '../WizardHelp';

type Props = {
  matches: string[];
  onRemoveMatch: (match: string) => void;
};

const labelContainerStyle = style({
  marginTop: 20,
  height: 40
});

class Matches extends React.Component<Props> {
  render() {
    const matches: any[] = this.props.matches.map((match, index) => (
      <span key={match + '-' + index} data-test={match}>
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
          Matching selected
          {wizardTooltip(MATCHING_SELECTED_TOOLTIP)}
        </span>
        {matches.length > 0 ? matches : <b>Match any request</b>}
      </div>
    );
  }
}

export default Matches;

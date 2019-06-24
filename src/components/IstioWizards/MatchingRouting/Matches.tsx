import * as React from 'react';
import { Label } from 'patternfly-react';
import { style } from 'typestyle';

type Props = {
  matches: string[];
  onRemoveMatch: (match: string) => void;
};

const labelContainerStyle = style({
  marginTop: 5
});

const labelMatchStyle = style({});

class Matches extends React.Component<Props> {
  render() {
    const matches: any[] = this.props.matches.map((match, index) => (
      <span key={match + '-' + index}>
        <Label className={labelMatchStyle} type="primary" onRemoveClick={() => this.props.onRemoveMatch(match)}>
          {match}
        </Label>{' '}
      </span>
    ));
    return (
      <div className={labelContainerStyle}>
        Matching selected: {matches.length > 0 ? matches : <b>Match any request</b>}
      </div>
    );
  }
}

export default Matches;

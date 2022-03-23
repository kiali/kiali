import * as React from 'react';
import { AngleDownIcon, AngleRightIcon } from '@patternfly/react-icons';

// This "Expandable" class can replace the collapse/expand mechanism of patternfly-table.
// While patternfly-table collapse would trigger a full table re-rendering,
// this one is more fine-grained, only the affected cells being re-rendered.

type ExpandListener = (isExpanded: boolean) => void;
const notify = (listeners: ExpandListener[], expand: boolean) => listeners.forEach(l => l(expand));

export const createListeners = (): ExpandListener[] => [];
export type CellProps<R> = R & { isExpanded: boolean };

type ExpandableProps<R> = R & {
  listeners: ExpandListener[];
  isExpanded: boolean;
  clickToExpand: boolean;
  innerComponent: React.ComponentType<R & { isExpanded: boolean }>;
};

type ExpandableState = {
  isExpanded: boolean;
};

export class Expandable<R> extends React.Component<ExpandableProps<R>, ExpandableState> {
  constructor(props: ExpandableProps<R>) {
    super(props);
    this.state = { isExpanded: props.isExpanded };
  }

  componentDidMount() {
    this.props.listeners.push(x => this.setState({ isExpanded: x }));
  }

  render() {
    const InnerComponent: React.ComponentType<R & { isExpanded: boolean }> = this.props.innerComponent;
    const inner = <InnerComponent {...this.props} isExpanded={this.state.isExpanded} />;
    if (this.props.clickToExpand) {
      return (
        <span style={{ cursor: 'pointer' }} onClick={() => notify(this.props.listeners, !this.state.isExpanded)}>
          {inner}
        </span>
      );
    }
    return inner;
  }
}

export const renderExpandArrow = (listeners: ExpandListener[], isExpanded: boolean) => {
  return (
    <Expandable
      listeners={listeners}
      isExpanded={isExpanded}
      clickToExpand={true}
      innerComponent={(props: { isExpanded: boolean }) => (props.isExpanded ? <AngleDownIcon /> : <AngleRightIcon />)}
    />
  );
};

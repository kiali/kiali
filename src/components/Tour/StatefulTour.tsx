import * as React from 'react';
import Tour, { Step } from './Tour';

export interface StatefulStep extends Step {
  isVisible?: (target: any) => boolean;
}

interface StatefulTourProps {
  steps: Array<StatefulStep>;
  isOpen: boolean;
  onClose: () => void;
}

enum Direction {
  NEXT,
  BACK
}

interface StatefulTourState {
  currentStep: number;
  direction: Direction;
}

export default class StatefulTour extends React.Component<StatefulTourProps, StatefulTourState> {
  constructor(props: StatefulTourProps) {
    super(props);
    this.state = {
      currentStep: 0,
      direction: Direction.NEXT
    };
  }

  componentDidUpdate(prevProps: StatefulTourProps) {
    if (!this.props.isOpen) {
      return;
    }
    if (!prevProps.isOpen) {
      this.setState(() => {
        return {
          currentStep: 0,
          direction: Direction.NEXT
        };
      });
      return;
    }
    const step = this.props.steps[this.state.currentStep];
    if (!this.isStepVisible(step)) {
      if (this.state.direction === Direction.NEXT) {
        this.onNext();
      } else {
        this.onBack();
      }
    }
  }

  isStepVisible(step: StatefulStep) {
    const element = document.querySelector(step.target);
    if (element && step.isVisible) {
      return step.isVisible(element);
    }
    return !!element;
  }

  isLast() {
    for (let i = this.state.currentStep + 1; i < this.props.steps.length; ++i) {
      if (this.isStepVisible(this.props.steps[i])) {
        return false;
      }
    }
    return true;
  }

  onNext = () => {
    let isLast = false;
    this.setState(prevState => {
      isLast = prevState.currentStep + 1 === this.props.steps.length;
      if (isLast) {
        this.props.onClose();
        return null;
      } else {
        return { currentStep: prevState.currentStep + 1, direction: Direction.NEXT };
      }
    });
  };

  onBack = () => {
    this.setState(prevState => {
      return { currentStep: prevState.currentStep - 1, direction: Direction.BACK };
    });
  };

  render() {
    // Determine de step number depending if the elements are available or not.
    const stepNumber = this.props.steps.slice(0, this.state.currentStep).reduce((count: number, step: StatefulStep) => {
      if (this.isStepVisible(step)) {
        return count + 1;
      }
      return count;
    }, 1);

    return (
      <Tour
        onNext={this.onNext}
        onClose={this.props.onClose}
        onBack={this.onBack}
        currentStep={this.state.currentStep}
        stepNumber={stepNumber}
        show={this.props.isOpen}
        steps={this.props.steps}
        isLast={this.isLast()}
      >
        {this.props.children}
      </Tour>
    );
  }
}

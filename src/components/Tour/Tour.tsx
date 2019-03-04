import * as React from 'react';
import { Button, Icon } from 'patternfly-react';
import { PfColors } from '../Pf/PfColors';
import ReactResizeDetector from 'react-resize-detector';
import { style } from 'typestyle';

// We have to import it like this, because current index.d.ts file is broken for this component.
const Floater = require('react-floater').default;

export enum StepPlacement {
  AUTO = 'auto',
  TOP = 'top',
  TOP_START = 'top-start',
  TOP_END = 'top-end',
  RIGHT = 'right',
  RIGHT_START = 'right-start',
  RIGHT_END = 'right-end',
  BOTTOM = 'bottom',
  BOTTOM_START = 'bottom-start',
  BOTTOM_END = 'bottom-end',
  LEFT = 'left',
  LEFT_START = 'left-start',
  LEFT_END = 'left-end'
}

export interface Step {
  name: string;
  target: string;
  description: string;
  placement?: StepPlacement;
  offset?: number;
}

interface TourProps {
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  currentStep: number;
  stepNumber: number;
  isLast: boolean;
  show: boolean;
  steps: Array<Step>;
}

const defaults = {
  placement: StepPlacement.AUTO,
  offset: 15
};

const buttonTextStyle = style({ fontSize: '0.9em' });
const stepNumberStyle = style({
  borderRadius: '20px',
  backgroundColor: PfColors.Blue300,
  padding: '2px 6px',
  marginRight: '10px',
  color: PfColors.White
});
const modalContent = style({ width: '25em' });
const modalHeader = style({ padding: '5px 10px' });
const modalBody = style({ fontSize: '0.95em', padding: '10px 15px' });
const modalFooter = style({ paddingTop: 0, marginTop: 0 });

const BackButton = (props: TourProps) => {
  if (props.currentStep === 0) {
    return null;
  }
  return (
    <Button className={buttonTextStyle} onClick={props.onBack}>
      <Icon type="fa" name="angle-left" /> Back
    </Button>
  );
};

const NextButton = (props: TourProps) => {
  return (
    <Button className={buttonTextStyle} bsStyle="primary" onClick={props.onNext}>
      {props.isLast ? (
        'Done'
      ) : (
        <>
          Next <Icon type="fa" name="angle-right" />
        </>
      )}
    </Button>
  );
};

const StepNumber = (stepNumber: number) => {
  return <span className={stepNumberStyle}>{stepNumber}</span>;
};

const TourModal = (props: TourProps, step: Step) => {
  return () => {
    return (
      <div className={`modal-content ${modalContent}`}>
        <div className={`modal-header ${modalHeader}`}>
          {StepNumber(props.stepNumber)}
          <span className="modal-title">{step.name}</span>
          <Button className="close" bsClass="default" onClick={props.onClose}>
            <Icon title="Close" type="pf" name="close" />
          </Button>
        </div>
        <div className={`modal-body ${modalBody}`}>{step.description}</div>
        <div className={`modal-footer ${modalFooter}`}>
          {BackButton(props)}
          {NextButton(props)}
        </div>
      </div>
    );
  };
};

export default class Tour extends React.PureComponent<TourProps> {
  popperRef: any = null;

  onResize = () => {
    if (this.popperRef) {
      this.popperRef!.instance.scheduleUpdate();
    }
  };

  render() {
    if (!this.props.show) {
      return null;
    }
    const step = this.props.steps[this.props.currentStep];

    return (
      <>
        <ReactResizeDetector
          refreshMode={'debounce'}
          refreshRate={100}
          skipOnMount={true}
          handleWidth={true}
          handleHeight={true}
          onResize={this.onResize}
        />
        <Floater
          getPopper={popper => {
            this.popperRef = popper;
          }}
          key={this.props.currentStep}
          disableAnimation={true}
          target={step.target}
          component={TourModal(this.props, step)}
          open={true}
          placement={step.placement ? step.placement : defaults.placement}
          offset={step.offset !== undefined ? step.offset : defaults.offset}
        />
      </>
    );
  }
}

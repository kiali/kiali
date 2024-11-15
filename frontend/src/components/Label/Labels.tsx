import * as React from 'react';
import { Label } from './Label';
import { Button, ButtonVariant, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { classes } from 'typestyle';
import { infoStyle } from 'styles/IconStyle';

const SHOW_MORE_TRESHOLD = 2;

interface LabelsProps {
  expanded?: boolean;
  labels?: { [key: string]: string };
  tooltipMessage?: string;
  type?: string;
}

const linkStyle = kialiStyle({
  padding: '0 0.25rem',
  fontSize: '0.8rem'
});

const labelInfoStyle = kialiStyle({
  marginLeft: '0.125rem',
  marginBottom: '0.125rem'
});

const labelsContainerStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  overflow: 'hidden'
});

export const Labels: React.FC<LabelsProps> = (props: LabelsProps) => {
  const [expanded, setExpanded] = React.useState<boolean>(props.expanded ?? false);

  const labelKeys = Object.keys(props.labels ?? {});

  const hasLabels = labelKeys.length > 0;

  const hasManyLabels = labelKeys.length > SHOW_MORE_TRESHOLD;

  const showItem = (i: number): boolean => {
    return expanded || !hasManyLabels || i < SHOW_MORE_TRESHOLD;
  };

  const expandLabels = (): void => {
    setExpanded(true);
  };

  const renderMoreLabelsLink =
    hasManyLabels && !expanded ? (
      <Button
        data-test="label_more"
        key="label_more"
        variant={ButtonVariant.link}
        className={linkStyle}
        onClick={expandLabels}
      >
        More {props.type ? props.type : 'labels'}...
      </Button>
    ) : null;

  const renderLabels = labelKeys.map((key, i) => {
    return showItem(i) ? (
      <div key={`label_div_${i}`} data-test={`${key}-label-container`}>
        <Label key={`label_${i}`} name={key} value={props.labels ? props.labels[key] : ''} />
      </div>
    ) : undefined;
  });

  const renderEmptyLabels = <span> No {props.type ? props.type : 'labels'} </span>;

  const tooltip = props.tooltipMessage ? (
    <Tooltip
      key="tooltip_missing_sidecar"
      position={TooltipPosition.auto}
      content={<div style={{ textAlign: 'left' }}>{props.tooltipMessage}</div>}
    >
      <KialiIcon.Info className={classes(infoStyle, labelInfoStyle)} />
    </Tooltip>
  ) : undefined;

  return (
    <div className={labelsContainerStyle}>
      {hasLabels ? [renderLabels, renderMoreLabelsLink] : renderEmptyLabels}

      {tooltip}
    </div>
  );
};

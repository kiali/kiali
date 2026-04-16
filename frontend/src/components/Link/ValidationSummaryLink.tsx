import * as React from 'react';
import { IstioConfigListLink } from './IstioConfigListLink';
import { naTextStyle } from 'styles/HealthStyle';

type Props = {
  children: React.ReactNode;
  errors: number;
  namespace: string;
  objectCount?: number;
  warnings: number;
};

export const ValidationSummaryLink: React.FC<Props> = (props: Props) => {
  if (!props.objectCount || props.objectCount <= 0) {
    return <div className={naTextStyle}>n/a</div>;
  }

  return (
    <IstioConfigListLink
      namespaces={[props.namespace]}
      warnings={props.warnings > 0}
      errors={props.errors > 0}
      issues={props.warnings || props.errors ? props.warnings + props.errors : undefined}
    >
      {props.children}
    </IstioConfigListLink>
  );
};

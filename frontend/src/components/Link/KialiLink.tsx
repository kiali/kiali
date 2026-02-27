import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';
import { useKialiSelector } from '../../hooks/redux';

type KialiLinkProps = {
  children: React.ReactNode;
  className?: string;
  dataTest?: string;
  onClick?: () => void;
  to: string;
};

export const KialiLink: React.FC<KialiLinkProps> = (props: KialiLinkProps) => {
  const kiosk = useKialiSelector(state => state.globalState.kiosk);

  const handleClick = (): void => {
    props.onClick?.();
    if (isParentKiosk(kiosk)) {
      kioskContextMenuAction(props.to);
    }
  };

  return isParentKiosk(kiosk) ? (
    <Button variant="link" isInline onClick={handleClick} data-test={props.dataTest}>
      <span className={props.className}>{props.children}</span>
    </Button>
  ) : (
    <Link to={props.to} className={props.className} data-test={props.dataTest} onClick={props.onClick}>
      {props.children}
    </Link>
  );
};

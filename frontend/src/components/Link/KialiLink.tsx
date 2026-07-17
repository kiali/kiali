import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { Link } from 'react-router';
import { isParentKiosk, kioskNavigateAction } from '../Kiosk/KioskActions';
import { useKialiSelector } from '../../hooks/redux';
import { getParamsSeparator } from '../../utils/SearchParamUtils';
import { navigateApp } from '../../app/History';

type KialiLinkProps = {
  children: React.ReactNode;
  className?: string;
  dataTest?: string;
  id?: string;
  kioskParams?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  to: string;
};

export const KialiLink: React.FC<KialiLinkProps> = (props: KialiLinkProps) => {
  const kiosk = useKialiSelector(state => state.globalState.kiosk);

  const handleClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    props.onClick?.();

    if (isParentKiosk(kiosk)) {
      let href = props.to;
      if (props.kioskParams) {
        href += `${getParamsSeparator(href)}${props.kioskParams}`;
      }
      kioskNavigateAction(href);
      return;
    }

    // flushSync so the destination route mounts before the next paint (React 18).
    navigateApp(props.to);
  };

  return isParentKiosk(kiosk) ? (
    <Button
      variant="link"
      isInline
      onClick={handleClick}
      data-test={props.dataTest}
      data-href={props.to}
      id={props.id}
      style={props.style}
    >
      <span className={props.className}>{props.children}</span>
    </Button>
  ) : (
    <Link
      to={props.to}
      className={props.className}
      data-test={props.dataTest}
      id={props.id}
      onClick={handleClick}
      style={props.style}
    >
      {props.children}
    </Link>
  );
};

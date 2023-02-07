import * as React from 'react';
import { useKialiSelector } from '../../hooks/redux';
import { isKiosk } from './KioskActions';

export function KioskElement(props: React.PropsWithChildren<{}>) {
  const kiosk = useKialiSelector(state => state.globalState.kiosk);

  if (!isKiosk(kiosk)) {
    return null;
  }

  return <>{props.children}</>;
}

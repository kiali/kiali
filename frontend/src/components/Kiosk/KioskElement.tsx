import * as React from "react";
import { useSelector } from "react-redux";
import { KialiAppState } from "../../store/Store";
import { isKiosk } from "./KioskActions";

export function KioskElement(props: React.PropsWithChildren<{}>) {
  const kiosk = useSelector<KialiAppState, string>((state) => state.globalState.kiosk);

  if (!isKiosk(kiosk)) {
    return null;
  }

  return (<>{props.children}</>);
}

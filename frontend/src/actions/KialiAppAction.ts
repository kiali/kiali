import { GlobalAction } from './GlobalActions';
import { GraphAction } from './GraphActions';
import { GraphToolbarAction } from './GraphToolbarActions';
import { HelpDropdownAction } from './HelpDropdownActions';
import { LoginAction } from './LoginActions';
import { MessageCenterAction } from './MessageCenterActions';
import { NamespaceAction } from './NamespaceAction';
import { ClusterAction } from './ClusterAction';
import { UserSettingsAction } from './UserSettingsActions';
import { JaegerAction } from './JaegerActions';
import { MeshTlsAction } from './MeshTlsActions';
import { TourAction } from './TourActions';
import { IstioStatusAction } from './IstioStatusActions';
import { MetricsStatsAction } from './MetricsStatsActions';
import { IstioCertsInfoAction } from './IstioCertsInfoActions';

export type KialiAppAction =
  | ClusterAction
  | GlobalAction
  | GraphAction
  | GraphToolbarAction
  | HelpDropdownAction
  | IstioCertsInfoAction
  | IstioStatusAction
  | JaegerAction
  | LoginAction
  | MeshTlsAction
  | MessageCenterAction
  | MetricsStatsAction
  | NamespaceAction
  | TourAction
  | UserSettingsAction;

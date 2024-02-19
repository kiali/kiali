import { GlobalAction } from './GlobalActions';
import { GraphAction } from './GraphActions';
import { GraphToolbarAction } from './GraphToolbarActions';
import { HelpDropdownAction } from './HelpDropdownActions';
import { LoginAction } from './LoginActions';
import { MessageCenterAction } from './MessageCenterActions';
import { NamespaceAction } from './NamespaceAction';
import { ClusterAction } from './ClusterAction';
import { UserSettingsAction } from './UserSettingsActions';
import { TracingAction } from './TracingActions';
import { MeshTlsAction } from './MeshTlsActions';
import { TourAction } from './TourActions';
import { IstioStatusAction } from './IstioStatusActions';
import { MetricsStatsAction } from './MetricsStatsActions';
import { IstioCertsInfoAction } from './IstioCertsInfoActions';
import { MeshAction } from './MeshActions';
import { MeshToolbarAction } from './MeshToolbarActions';

export type KialiAppAction =
  | ClusterAction
  | GlobalAction
  | GraphAction
  | GraphToolbarAction
  | HelpDropdownAction
  | IstioCertsInfoAction
  | IstioStatusAction
  | TracingAction
  | LoginAction
  | MeshAction
  | MeshTlsAction
  | MeshToolbarAction
  | MessageCenterAction
  | MetricsStatsAction
  | NamespaceAction
  | TourAction
  | UserSettingsAction;

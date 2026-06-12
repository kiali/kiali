import { GlobalAction } from './GlobalActions';
import { GraphAction } from './GraphActions';
import { GraphToolbarAction } from './GraphToolbarActions';
import { HelpDropdownAction } from './HelpDropdownActions';
import { LoginAction } from './LoginActions';
import { NotificationCenterAction } from './NotificationCenterActions';
import { NamespaceAction } from './NamespaceAction';
import { NamespacesListAction } from './NamespacesListActions';
import { ServicesListAction } from './ServicesListActions';
import { AppsListAction } from './AppsListActions';
import { WorkloadsListAction } from './WorkloadsListActions';
import { ClusterAction } from './ClusterAction';
import { UserSettingsAction } from './UserSettingsActions';
import { TracingAction } from './TracingActions';
import { MeshTlsAction } from './MeshTlsActions';
import { TourAction } from './TourActions';
import { IstioStatusAction } from './IstioStatusActions';
import { MetricsStatsAction } from './MetricsStatsActions';
import { MeshAction } from './MeshActions';
import { MeshToolbarAction } from './MeshToolbarActions';
import { ChatAIAction } from './ChatAIActions';

export type KialiAppAction =
  | ChatAIAction
  | ClusterAction
  | GlobalAction
  | GraphAction
  | GraphToolbarAction
  | HelpDropdownAction
  | IstioStatusAction
  | TracingAction
  | LoginAction
  | MeshAction
  | MeshTlsAction
  | MeshToolbarAction
  | NotificationCenterAction
  | MetricsStatsAction
  | NamespaceAction
  | NamespacesListAction
  | ServicesListAction
  | AppsListAction
  | WorkloadsListAction
  | TourAction
  | UserSettingsAction;

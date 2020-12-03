import { GlobalAction } from './GlobalActions';
import { GraphAction } from './GraphActions';
import { GraphToolbarAction } from './GraphToolbarActions';
import { HelpDropdownAction } from './HelpDropdownActions';
import { LoginAction } from './LoginActions';
import { MessageCenterAction } from './MessageCenterActions';
import { NamespaceAction } from './NamespaceAction';
import { UserSettingsAction } from './UserSettingsActions';
import { JaegerAction } from './JaegerActions';
import { MeshTlsAction } from './MeshTlsActions';
import { TourAction } from './TourActions';
import { IstioStatusAction } from './IstioStatusActions';
import { MetricsStatsAction } from './MetricsStatsActions';

export type KialiAppAction =
  | GlobalAction
  | GraphAction
  | GraphToolbarAction
  | HelpDropdownAction
  | LoginAction
  | MessageCenterAction
  | NamespaceAction
  | UserSettingsAction
  | JaegerAction
  | MeshTlsAction
  | IstioStatusAction
  | TourAction
  | MetricsStatsAction;

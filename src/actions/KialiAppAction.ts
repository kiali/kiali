import { GlobalAction } from './GlobalActions';
import { GraphAction } from './GraphActions';
import { GraphDataAction } from './GraphDataActions';
import { GraphToolbarAction } from './GraphToolbarActions';
import { HelpDropdownAction } from './HelpDropdownActions';
import { LoginAction } from './LoginActions';
import { MessageCenterAction } from './MessageCenterActions';
import { NamespaceAction } from './NamespaceAction';
import { UserSettingsAction } from './UserSettingsActions';
import { JaegerAction } from './JaegerActions';
import { MeshTlsAction } from './MeshTlsActions';
import { TourAction } from './TourActions';

export type KialiAppAction =
  | GlobalAction
  | GraphAction
  | GraphDataAction
  | GraphToolbarAction
  | HelpDropdownAction
  | LoginAction
  | MessageCenterAction
  | NamespaceAction
  | UserSettingsAction
  | JaegerAction
  | MeshTlsAction
  | TourAction;

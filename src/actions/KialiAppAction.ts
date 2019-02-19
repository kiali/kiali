import { GlobalAction } from './GlobalActions';
import { GrafanaAction } from './GrafanaActions';
import { GraphAction } from './GraphActions';
import { GraphDataAction } from './GraphDataActions';
import { GraphFilterAction } from './GraphFilterActions';
import { HelpDropdownAction } from './HelpDropdownActions';
import { LoginAction } from './LoginActions';
import { MessageCenterAction } from './MessageCenterActions';
import { NamespaceAction } from './NamespaceAction';
import { UserSettingsAction } from './UserSettingsActions';
import { ServerConfigAction } from './ServerConfigActions';
import { JaegerAction } from './JaegerActions';

export type KialiAppAction =
  | GlobalAction
  | GrafanaAction
  | GraphAction
  | GraphDataAction
  | GraphFilterAction
  | HelpDropdownAction
  | LoginAction
  | MessageCenterAction
  | NamespaceAction
  | ServerConfigAction
  | UserSettingsAction
  | JaegerAction;

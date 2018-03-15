export interface RuleAction {
  handler: ActionHandler;
  instances: ActionInstance[];
}

export interface ActionHandler {
  name: string;
  adapter: string;
  spec: any;
}

export interface ActionInstance {
  name: string;
  template: string;
  spec: any;
}

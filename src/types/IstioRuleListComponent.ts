import Namespace from './Namespace';

export interface RuleList {
  namespace: Namespace;
  rules: RuleItem[];
}

export interface RuleItem {
  name: string;
  namespace: string;
  match: string;
  actions: RuleActionItem[];
}

export interface RuleActionItem {
  handler: string;
  instances: string[];
}

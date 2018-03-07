export interface Endpoints {
  addresses?: EndpointAddress[];
  ports?: Port[];
}

interface EndpointAddress {
  ip: string;
  kind?: string;
  name?: string;
}

interface Label {
  labels: Map<string, string>;
}

export interface Port {
  protocol: string;
  port: number;
  name: string;
}

export interface Pod {
  name: string;
  labels?: Map<string, string>;
}

export interface Source {
  destination: string;
  source: string;
}

export interface StringMatch {
  exact?: string;
  prefix?: string;
  regex?: string;
}

export interface MatchSource {
  name?: string;
  namespace?: string;
  domain?: string;
  service?: string;
  labels?: Map<String, String>;
}

export interface MatchRequest {
  source?: MatchSource;
  request?: Map<string, StringMatch>;
}

export interface Rule {
  name: string;
  destination?: Map<string, string>;
  precedence?: number;
  route?: Label[];
  match?: MatchRequest;
}

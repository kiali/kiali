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

export interface Rule {
  destination?: Map<string, string>;
  precedence?: number;
  route?: Label[];
}

/** Plain-data graph selectors (ported from cypress/integration/common/graph.ts). */

export type SelectOp =
  '=' | '!=' | '>' | '<' | '>=' | '<=' | '!*=' | '!$=' | '!^=' | '*=' | '$=' | '^=' | 'falsy' | 'truthy';

export type SelectExp = {
  op?: SelectOp;
  prop: string;
  val?: unknown;
};

export type SelectAnd = SelectExp[];
export type SelectOr = SelectAnd[];

export type GraphDataElement = { data: Record<string, unknown> };

export const select = (elems: GraphDataElement[], exp: SelectExp): GraphDataElement[] => {
  return elems.filter(e => {
    const propVal = (e.data[exp.prop] as unknown) ?? '';

    switch (exp.op) {
      case '!=':
        return propVal !== exp.val;
      case '<':
        return (propVal as number) < (exp.val as number);
      case '>':
        return (propVal as number) > (exp.val as number);
      case '>=':
        return (propVal as number) >= (exp.val as number);
      case '<=':
        return (propVal as number) <= (exp.val as number);
      case '!*=':
        return !(propVal as string).includes(exp.val as string);
      case '!$=':
        return !(propVal as string).endsWith(exp.val as string);
      case '!^=':
        return !(propVal as string).startsWith(exp.val as string);
      case '*=':
        return (propVal as string).includes(exp.val as string);
      case '$=':
        return (propVal as string).endsWith(exp.val as string);
      case '^=':
        return (propVal as string).startsWith(exp.val as string);
      case 'falsy':
        return !propVal;
      case 'truthy':
        return !!propVal;
      default:
        return propVal === exp.val;
    }
  });
};

export const selectAnd = (elems: GraphDataElement[], ands: SelectAnd): GraphDataElement[] => {
  let result = elems;
  ands.forEach(exp => (result = select(result, exp)));
  return result;
};

export const selectOr = (elems: GraphDataElement[], ors: SelectOr): GraphDataElement[] => {
  let result: GraphDataElement[] = [];
  ors.forEach(ands => {
    const andResult = selectAnd(elems, ands);
    result = Array.from(new Set([...result, ...andResult]));
  });
  return result;
};

/** Node and edge attribute keys from frontend/src/types/Graph.ts */
export const NodeAttr = {
  app: 'app',
  cluster: 'cluster',
  isBox: 'isBox',
  isIdle: 'isIdle',
  namespace: 'namespace',
  nodeType: 'nodeType',
  rank: 'rank',
  service: 'service',
  version: 'version',
  workload: 'workload',
  healthStatus: 'healthStatus',
  isFind: 'isFind',
  isOutside: 'isOutside'
} as const;

export const EdgeAttr = {
  hasTraffic: 'hasTraffic',
  isMTLS: 'isMTLS',
  responseTime: 'responseTime',
  throughput: 'throughput',
  http: 'http',
  httpPercentReq: 'httpPercentReq',
  grpc: 'grpc'
} as const;

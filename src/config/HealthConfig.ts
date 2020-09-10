import { HealthConfig, RegexConfig } from '../types/ServerConfig';

const allMatch = new RegExp('.*');

export const parseHealthConfig = (healthConfig: HealthConfig) => {
  for (let [key, r] of Object.entries(healthConfig.rate)) {
    healthConfig.rate[key].namespace = getExpr(healthConfig.rate[key].namespace);
    healthConfig.rate[key].name = getExpr(healthConfig.rate[key].name);
    healthConfig.rate[key].kind = getExpr(healthConfig.rate[key].kind);
    for (let t of Object.values(r.tolerance)) {
      t.code = getExpr(t.code);
      t.direction = getExpr(t.direction);
      t.protocol = getExpr(t.protocol);
    }
  }
  return healthConfig;
};

export const getExpr = (value: RegexConfig | undefined): RegExp => {
  if (value) {
    if (typeof value === 'string' && value !== '') {
      return new RegExp(value.replace('\\\\', '\\'));
    }
    if (typeof value === 'object' && value.toString() !== '/(?:)/') {
      return value;
    }
  }
  return allMatch;
};

/*
 Export for tests
*/
export const allMatchTEST = allMatch;
export const getExprTEST = getExpr;

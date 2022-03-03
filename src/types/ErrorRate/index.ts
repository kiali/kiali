import { getTrafficHealth } from './TrafficHealth';
import { aggregate, calculateErrorRate, calculateStatus, sumRequests } from './ErrorRate';
import { DEFAULTCONF, getRateHealthConfig } from './utils';

export { calculateErrorRate, DEFAULTCONF, getTrafficHealth };

/*

Export for testing

*/
export const getRateHealthConfigTEST = getRateHealthConfig;
export const calculateStatusTEST = calculateStatus;
export const aggregateTEST = aggregate;
export const sumRequestsTEST = sumRequests;

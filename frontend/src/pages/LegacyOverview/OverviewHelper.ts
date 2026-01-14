import { OverviewType } from './OverviewToolbar';

export const switchType = <T, U, V>(type: OverviewType, caseApp: T, caseService: U, caseWorkload: V): T | U | V => {
  return type === 'app' ? caseApp : type === 'service' ? caseService : caseWorkload;
};

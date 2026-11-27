import { test as setup } from '@playwright/test';

import { enableUseWaypointNameIfNeeded, prepareBookinfoWaypoint } from '../utils/waypointHelpers';

setup('prepare waypoint cluster and tracing names', async ({ request }) => {
  setup.setTimeout(900_000);
  await prepareBookinfoWaypoint(request);
  await enableUseWaypointNameIfNeeded(request, 'bookinfo');
});

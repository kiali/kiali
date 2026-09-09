import { test as setup } from '@playwright/test';

import { ensureKialiCachingForTests } from '../utils/kialiCaching';

setup('enable kiali caching', () => {
  ensureKialiCachingForTests();
});

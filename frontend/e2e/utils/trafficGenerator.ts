import { test } from '@playwright/test';
import { kubectlExec } from './kubectl';

/**
 * Skip when bookinfo traffic generator sends traffic directly to productpage instead of
 * through istio-ingressgateway (install-bookinfo-demo.sh fallback on kind without ingress).
 */
export const skipUnlessBookinfoTrafficUsesIngress = (): void => {
  const { exitCode, stdout } = kubectlExec(
    'kubectl get cm -n bookinfo traffic-generator-config -o jsonpath={.data.route} 2>/dev/null'
  );
  if (exitCode !== 0 || !stdout.trim()) {
    test.skip(true, 'bookinfo traffic-generator-config not found');
    return;
  }

  const route = stdout.trim();
  if (route.includes('productpage.bookinfo') || route.includes('productpage:9080')) {
    test.skip(
      true,
      'traffic generator uses direct productpage route; istio-ingressgateway inbound traffic is not expected'
    );
  }
};

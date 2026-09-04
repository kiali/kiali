import { getClusterForSingleCluster } from '../utils/cluster';
import { checkHealthIndicatorInTable, checkHealthStatusInTable } from '../utils/table';
import { ListPage } from './ListPage';

export class WorkloadsPage extends ListPage {
  constructor(page: ListPage['page']) {
    super(page, 'workloads');
  }

  async expectWorkloadListedAs(
    namespace: string,
    workload: string,
    healthStatus: 'healthy' | 'idle' | 'failure' | 'degraded'
  ): Promise<void> {
    const cluster = await getClusterForSingleCluster(this.page.request);
    await checkHealthIndicatorInTable(this.page, cluster, namespace, 'Deployment', workload, healthStatus);
  }

  async expectWorkloadHealthStatus(namespace: string, workload: string, healthStatus: string): Promise<void> {
    const cluster = await getClusterForSingleCluster(this.page.request);
    await checkHealthStatusInTable(this.page, cluster, namespace, 'Deployment', workload, healthStatus);
  }
}

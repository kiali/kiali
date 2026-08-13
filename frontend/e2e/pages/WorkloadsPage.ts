import { ListPage } from './ListPage';

export class WorkloadsPage extends ListPage {
  constructor(page: ListPage['page']) {
    super(page, 'workloads');
  }
}

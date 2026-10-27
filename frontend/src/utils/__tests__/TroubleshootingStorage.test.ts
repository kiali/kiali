import {
  HIDDEN_SUBPROBLEM_IDS_KEY,
  readHiddenSubProblemIds,
  writeHiddenSubProblemIds
} from '../TroubleshootingStorage';

describe('TroubleshootingStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips hidden subproblem ids and ignores invalid session data', () => {
    expect(readHiddenSubProblemIds()).toEqual([]);

    writeHiddenSubProblemIds(['sub-1', 'sub-2']);
    expect(readHiddenSubProblemIds()).toEqual(['sub-1', 'sub-2']);

    sessionStorage.setItem(HIDDEN_SUBPROBLEM_IDS_KEY, '{"id":"sub-1"}');
    expect(readHiddenSubProblemIds()).toEqual([]);

    sessionStorage.setItem(HIDDEN_SUBPROBLEM_IDS_KEY, 'not-json');
    expect(readHiddenSubProblemIds()).toEqual([]);
  });
});

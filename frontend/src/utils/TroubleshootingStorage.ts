export const HIDDEN_SUBPROBLEM_IDS_KEY = 'kiali-troubleshooting-hidden-subproblems';

// Ids the user hid in this browser tab. Redux is the live copy; sessionStorage
// restores them after a full reload so a refetch keeps the same subproblems hidden.
export const readHiddenSubProblemIds = (): string[] => {
  try {
    if (typeof sessionStorage === 'undefined') {
      return [];
    }
    const raw = sessionStorage.getItem(HIDDEN_SUBPROBLEM_IDS_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
};

export const writeHiddenSubProblemIds = (ids: readonly string[]): void => {
  try {
    sessionStorage.setItem(HIDDEN_SUBPROBLEM_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Session storage can be unavailable (private mode, blocked storage).
  }
};

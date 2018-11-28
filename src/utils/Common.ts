export const removeDuplicatesArray = a => [...Array.from(new Set(a))] as string[];

export const arrayEquals = <T>(a1: T[], a2: T[], comparator: (v1: T, v2: T) => boolean) => {
  if (a1.length !== a2.length) {
    return false;
  }
  for (let i = 0; i < a1.length; ++i) {
    if (!comparator(a1[i], a2[i])) {
      return false;
    }
  }
  return true;
};

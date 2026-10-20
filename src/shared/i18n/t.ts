export interface Dict {
  [key: string]: string | Dict;
}

export function createT(dict: Dict) {
  return (key: string): string => {
    const parts = key.split(".");
    let cur: unknown = dict;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    return typeof cur === "string" ? cur : key;
  };
}

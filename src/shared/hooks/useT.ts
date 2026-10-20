import { useMemo } from "react";
import { createT, type Dict } from "@/shared/i18n/t";

export function useT(dict: Dict) {
  return useMemo(() => createT(dict), [dict]);
}

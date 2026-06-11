import { create } from "zustand";
import type { Conclusion, SourceDocument } from "@/types/analysis";

interface AnalysisStore {
  // conclusion_id -> Conclusion (assembled from all agent module outputs)
  conclusions: Record<string, Conclusion>;
  activeDoc: SourceDocument | null;

  setConclusions: (c: Record<string, Conclusion>) => void;
  setActiveDoc: (d: SourceDocument | null) => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  conclusions: {},
  activeDoc: null,
  setConclusions: (conclusions) => set({ conclusions }),
  setActiveDoc: (activeDoc) => set({ activeDoc }),
}));

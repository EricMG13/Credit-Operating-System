import { create } from "zustand";
import type { Issuer } from "@/types/issuers";
import type { AgentOutputs, DagRun } from "@/types/agents";

interface IssuerStore {
  issuers: Issuer[];
  selectedIssuer: Issuer | null;
  dagRun: DagRun | null;
  agentOutputs: AgentOutputs | null;
  historicalView: boolean; // Toggle between current and frozen historical state

  setIssuers: (issuers: Issuer[]) => void;
  selectIssuer: (issuer: Issuer | null) => void;
  setDagRun: (run: DagRun | null) => void;
  setAgentOutputs: (outputs: AgentOutputs | null) => void;
  toggleHistoricalView: () => void;
}

export const useIssuerStore = create<IssuerStore>((set) => ({
  issuers: [],
  selectedIssuer: null,
  dagRun: null,
  agentOutputs: null,
  historicalView: false,

  setIssuers: (issuers) => set({ issuers }),
  selectIssuer: (issuer) => set({ selectedIssuer: issuer, agentOutputs: null }),
  setDagRun: (dagRun) => set({ dagRun }),
  setAgentOutputs: (agentOutputs) => set({ agentOutputs }),
  toggleHistoricalView: () => set((s) => ({ historicalView: !s.historicalView })),
}));

import { create } from "zustand";

type ActivePanel = "vault" | "cockpit" | "split";
type ActiveChart = "financials" | "liquidity" | "covenants" | "rv" | "debate";

interface UIStore {
  activePanel: ActivePanel;
  activeChart: ActiveChart;
  pdfUrl: string | null;
  pdfPage: number;
  sidebarOpen: boolean;

  setActivePanel: (panel: ActivePanel) => void;
  setActiveChart: (chart: ActiveChart) => void;
  openPdf: (url: string, page?: number) => void;
  closePdf: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePanel: "split",
  activeChart: "financials",
  pdfUrl: null,
  pdfPage: 1,
  sidebarOpen: true,

  setActivePanel: (activePanel) => set({ activePanel }),
  setActiveChart: (activeChart) => set({ activeChart }),
  openPdf: (pdfUrl, pdfPage = 1) => set({ pdfUrl, pdfPage, activePanel: "split" }),
  closePdf: () => set({ pdfUrl: null }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

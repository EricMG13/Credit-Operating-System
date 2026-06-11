"use client";

import dynamic from "next/dynamic";
import { useUIStore } from "@/store/ui";

// Lazy-load PDF viewer to avoid SSR issues (pdfjs-dist requires browser globals)
const PDFViewerCore = dynamic(
  () =>
    import("@react-pdf-viewer/core").then(({ Viewer, Worker }) => {
      const Wrapped = ({ url }: { url: string }) => (
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <div className="h-full overflow-auto">
            <Viewer fileUrl={url} />
          </div>
        </Worker>
      );
      Wrapped.displayName = "PDFViewerCore";
      return { default: Wrapped };
    }),
  { ssr: false, loading: () => <div className="p-4 text-gray-400 text-xs">Loading PDF...</div> }
);

export function PDFViewer({ url }: { url: string }) {
  const { closePdf } = useUIStore();

  return (
    <div className="flex flex-col h-full">
      {/* PDF toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900 shrink-0">
        <span className="text-xs text-gray-400 truncate">{url.split("/").pop()}</span>
        <button
          onClick={closePdf}
          className="text-gray-500 hover:text-gray-300 text-xs ml-3 shrink-0"
        >
          ✕ Close
        </button>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-hidden">
        <PDFViewerCore url={url} />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { PDFViewer } from "./PDFViewer";
import { useUIStore } from "@/store/ui";

interface Props {
  issuerId: string;
}

const DOC_TYPES = ["OM", "CreditAgreement", "LBOModel", "InterimReport", "PricingSheet"];

export function DocumentVault({ issuerId }: Props) {
  const { pdfUrl, openPdf } = useUIStore();
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState("OM");

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    const form = new FormData();
    form.append("file", file);
    form.append("issuer_id", issuerId);
    form.append("doc_type", selectedDocType);

    setUploadStatus("Uploading...");
    try {
      const { uploadDocument } = await import("@/lib/api");
      await uploadDocument(form);
      setUploadStatus(`✓ ${file.name} uploaded`);
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (e) {
      setUploadStatus(`✗ Upload failed`);
    }
  }, [issuerId, selectedDocType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Vault header */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <h2 className="text-white text-sm font-semibold">Document Vault</h2>
        <p className="text-gray-500 text-xs mt-0.5">Source documents · Click to open · Drag to upload</p>
      </div>

      {pdfUrl ? (
        <PDFViewer url={pdfUrl} />
      ) : (
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Upload zone */}
          <div className="p-3 border-b border-gray-800">
            <div className="flex gap-2 mb-2">
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1.5 focus:outline-none"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-gray-700 hover:border-gray-600"
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-gray-500 text-xs">
                {isDragActive ? "Drop PDF here" : "Drag PDF here or click to browse"}
              </p>
              {uploadStatus && (
                <p className="mt-1 text-xs text-blue-400">{uploadStatus}</p>
              )}
            </div>
          </div>

          {/* Empty state */}
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <div className="text-3xl mb-3">📄</div>
              <p className="text-gray-400 text-sm">No document selected</p>
              <p className="text-gray-600 text-xs mt-1">Upload a document to view it here</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

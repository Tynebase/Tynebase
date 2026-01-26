"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { 
  Upload, 
  Download, 
  FileText, 
  FolderOpen,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  FileJson,
  FileCode,
  File,
  ExternalLink
} from "lucide-react";

const importSources = [
  {
    id: "notion",
    name: "Notion",
    description: "Import pages and databases from Notion",
    icon: "N",
    color: "brand",
    supported: true,
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Migrate from Atlassian Confluence",
    icon: "C",
    color: "blue",
    supported: true,
  },
  {
    id: "gitbook",
    name: "GitBook",
    description: "Import from GitBook spaces",
    icon: "G",
    color: "purple",
    supported: true,
  },
  {
    id: "markdown",
    name: "Markdown Files",
    description: "Upload .md files or ZIP archives",
    icon: "MD",
    color: "cyan",
    supported: true,
  },
  {
    id: "html",
    name: "HTML Files",
    description: "Import HTML documentation",
    icon: "H",
    color: "pink",
    supported: true,
  },
  {
    id: "docusaurus",
    name: "Docusaurus",
    description: "Coming soon",
    icon: "D",
    color: "brand",
    supported: false,
  },
];

const exportFormats = [
  {
    id: "markdown",
    name: "Markdown",
    description: "Export as .md files with frontmatter",
    icon: FileCode,
    extension: ".md",
  },
  {
    id: "html",
    name: "HTML",
    description: "Export as static HTML pages",
    icon: FileText,
    extension: ".html",
  },
  {
    id: "pdf",
    name: "PDF",
    description: "Export as printable PDF documents",
    icon: File,
    extension: ".pdf",
  },
  {
    id: "json",
    name: "JSON",
    description: "Export raw data with metadata",
    icon: FileJson,
    extension: ".json",
  },
];

const recentImports = [
  { id: 1, source: "Notion", documents: 45, status: "completed", timestamp: "2026-01-10T14:30:00Z" },
  { id: 2, source: "Markdown Files", documents: 12, status: "completed", timestamp: "2026-01-08T09:15:00Z" },
  { id: 3, source: "Confluence", documents: 0, status: "failed", timestamp: "2026-01-05T11:00:00Z", error: "Authentication expired" },
];

export default function ImportExportPage() {
  const [activeTab, setActiveTab] = useState<"import" | "export">("import");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("markdown");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = () => {
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const handleExport = () => {
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Import & Export</h1>
        <p className="text-[var(--text-tertiary)] mt-1">
          Migrate your content or export your knowledge base
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => setActiveTab("import")}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "import"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Upload className="w-4 h-4 inline-block mr-2" />
          Import
        </button>
        <button
          onClick={() => setActiveTab("export")}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "export"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Download className="w-4 h-4 inline-block mr-2" />
          Export
        </button>
      </div>

      {activeTab === "import" ? (
        <>
          {/* Import Sources */}
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Choose Import Source</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {importSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => source.supported && setSelectedSource(source.id)}
                  disabled={!source.supported}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedSource === source.id
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                      : source.supported
                      ? "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                      : "border-[var(--border-subtle)] opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center mb-3 text-sm font-bold text-[var(--brand)]`}>
                    {source.icon}
                  </div>
                  <h3 className="font-medium text-[var(--text-primary)]">{source.name}</h3>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">{source.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Import Actions */}
          {selectedSource && (
            <Card>
              <CardContent className="p-6">
                {selectedSource === "markdown" || selectedSource === "html" ? (
                  <div className="border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8 text-center hover:border-[var(--brand-primary)] transition-colors cursor-pointer">
                    <Upload className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                    <p className="font-medium text-[var(--text-primary)] mb-2">
                      Drop files here or click to browse
                    </p>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      {selectedSource === "markdown" ? "Supports .md files and .zip archives" : "Supports .html files and .zip archives"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-[var(--surface-ground)] rounded-lg">
                      <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary)]/10 flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-[var(--brand-primary)]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-[var(--text-primary)]">Connect to {importSources.find(s => s.id === selectedSource)?.name}</p>
                        <p className="text-sm text-[var(--text-tertiary)]">Authorize TyneBase to access your workspace</p>
                      </div>
                      <Button variant="primary">
                        Connect
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-6 pt-6 border-t border-[var(--border-subtle)]">
                  <Button variant="ghost" onClick={() => setSelectedSource(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleImport} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Start Import
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Imports */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Imports</CardTitle>
              <CardDescription>Your import history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentImports.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-[var(--surface-ground)] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        item.status === "completed"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}>
                        {item.status === "completed" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {item.source}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {item.status === "completed" 
                            ? `${item.documents} documents imported`
                            : item.error
                          }
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Export Formats */}
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Choose Export Format</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {exportFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedFormat === format.id
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                    }`}
                  >
                    <Icon className={`w-8 h-8 mb-3 ${
                      selectedFormat === format.id 
                        ? "text-[var(--brand-primary)]" 
                        : "text-[var(--text-tertiary)]"
                    }`} />
                    <h3 className="font-medium text-[var(--text-primary)]">{format.name}</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{format.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
              <CardDescription>Configure your export</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[var(--surface-ground)] rounded-lg">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-[var(--text-tertiary)]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">All Documents</p>
                    <p className="text-sm text-[var(--text-tertiary)]">Export entire knowledge base</p>
                  </div>
                </div>
                <input type="radio" name="scope" defaultChecked className="w-4 h-4 accent-[var(--brand-primary)]" />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-[var(--surface-ground)] rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[var(--text-tertiary)]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Selected Folder</p>
                    <p className="text-sm text-[var(--text-tertiary)]">Export specific folders</p>
                  </div>
                </div>
                <input type="radio" name="scope" className="w-4 h-4 accent-[var(--brand-primary)]" />
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-[var(--brand-primary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">Include images and attachments</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer mt-3">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-[var(--brand-primary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">Include metadata (authors, dates, tags)</span>
                </label>
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="primary" onClick={handleExport} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Preparing Export...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export as {exportFormats.find(f => f.id === selectedFormat)?.name}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

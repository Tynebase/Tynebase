"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { updateTenant } from "@/lib/api/tenants";
import { createDocument } from "@/lib/api/documents";
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
    description: "Coming soon",
    icon: "N",
    color: "brand",
    supported: false,
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Coming soon",
    icon: "C",
    color: "blue",
    supported: false,
  },
  {
    id: "gitbook",
    name: "GitBook",
    description: "Coming soon",
    icon: "G",
    color: "purple",
    supported: false,
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
    description: "Export individual documents as .md files",
    icon: FileCode,
    extension: ".md",
  },
  {
    id: "docx",
    name: "Word (DOCX)",
    description: "Export individual documents as Word files",
    icon: FileText,
    extension: ".docx",
  },
  {
    id: "pdf",
    name: "PDF",
    description: "Export individual documents as PDF files",
    icon: File,
    extension: ".pdf",
  },
];

const recentImports = [
  { id: 1, source: "Notion", documents: 45, status: "completed", timestamp: "2026-01-10T14:30:00Z" },
  { id: 2, source: "Markdown Files", documents: 12, status: "completed", timestamp: "2026-01-08T09:15:00Z" },
  { id: 3, source: "Confluence", documents: 0, status: "failed", timestamp: "2026-01-05T11:00:00Z", error: "Authentication expired" },
];

export default function ImportExportPage() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"import" | "export">("import");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("markdown");
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current export setting
  useEffect(() => {
    if (tenant?.settings?.features?.document_export_enabled !== undefined) {
      setExportEnabled(tenant.settings.features.document_export_enabled);
    } else {
      // Default to true if not set
      setExportEnabled(true);
    }
  }, [tenant]);

  const isAdmin = user?.role === 'admin';

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      let successCount = 0;
      
      for (const file of Array.from(files)) {
        if (selectedSource === "markdown" && file.name.endsWith('.md')) {
          const content = await file.text();
          const title = file.name.replace('.md', '');
          
          await createDocument({
            title,
            content,
          });
          successCount++;
        } else if (selectedSource === "html" && file.name.endsWith('.html')) {
          const htmlContent = await file.text();
          
          // Convert HTML to markdown (basic conversion)
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          const title = doc.querySelector('title')?.textContent || file.name.replace('.html', '');
          
          // Extract text content and preserve some structure
          let markdown = '';
          const body = doc.body;
          
          if (body) {
            // Simple HTML to Markdown conversion
            const processNode = (node: Node): string => {
              if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent || '';
              }
              
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                const tag = element.tagName.toLowerCase();
                const children = Array.from(element.childNodes).map(processNode).join('');
                
                switch (tag) {
                  case 'h1': return `# ${children}\n\n`;
                  case 'h2': return `## ${children}\n\n`;
                  case 'h3': return `### ${children}\n\n`;
                  case 'h4': return `#### ${children}\n\n`;
                  case 'h5': return `##### ${children}\n\n`;
                  case 'h6': return `###### ${children}\n\n`;
                  case 'p': return `${children}\n\n`;
                  case 'br': return '\n';
                  case 'strong': case 'b': return `**${children}**`;
                  case 'em': case 'i': return `*${children}*`;
                  case 'code': return `\`${children}\``;
                  case 'pre': return `\`\`\`\n${children}\n\`\`\`\n\n`;
                  case 'a': return `[${children}](${element.getAttribute('href') || '#'})`;
                  case 'ul': return `${children}\n`;
                  case 'ol': return `${children}\n`;
                  case 'li': return `- ${children}\n`;
                  case 'blockquote': return `> ${children}\n\n`;
                  default: return children;
                }
              }
              
              return '';
            };
            
            markdown = processNode(body).trim();
          }
          
          await createDocument({
            title,
            content: markdown || htmlContent,
          });
          successCount++;
        }
      }
      
      if (successCount > 0) {
        setUploadSuccess(`Successfully imported ${successCount} document${successCount > 1 ? 's' : ''}`);
        setSelectedSource(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setUploadError('No valid files found to import');
      }
    } catch (err) {
      console.error('Import failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to import files');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleExport = () => {
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const handleToggleExport = async (enabled: boolean) => {
    if (!isAdmin || !tenant) return;
    
    setIsSaving(true);
    try {
      await updateTenant(tenant.id, {
        settings: {
          ...tenant.settings,
          features: {
            ...tenant.settings?.features,
            document_export_enabled: enabled,
          },
        },
      });
      setExportEnabled(enabled);
    } catch (err) {
      console.error('Failed to update export setting:', err);
      alert('Failed to update setting. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Import & Export</h1>
        <p className="text-[var(--text-tertiary)] mt-1">
          Migrate your content or export your knowledge base
        </p>
      </div>

      {/* Feature Toggle - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Document Export Feature</CardTitle>
            <CardDescription>Control whether users can export documents from the editor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-[var(--surface-ground)] rounded-lg">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-[var(--text-tertiary)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Enable Document Export</p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Allow users to export documents as Markdown, Word, or PDF from the editor
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportEnabled}
                  onChange={(e) => handleToggleExport(e.target.checked)}
                  disabled={isSaving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--brand-primary)]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)] disabled:opacity-50 disabled:cursor-not-allowed"></div>
              </label>
            </div>
            {isSaving && (
              <div className="flex items-center gap-2 mt-3 text-sm text-[var(--text-tertiary)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                {uploadError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-800">{uploadError}</p>
                  </div>
                )}
                
                {uploadSuccess && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-800">{uploadSuccess}</p>
                  </div>
                )}
                
                {selectedSource === "markdown" || selectedSource === "html" ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={selectedSource === "markdown" ? ".md" : ".html"}
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div 
                      onClick={handleImport}
                      className="border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8 text-center hover:border-[var(--brand-primary)] transition-colors cursor-pointer"
                    >
                      <Upload className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                      <p className="font-medium text-[var(--text-primary)] mb-2">
                        Click to browse files
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {selectedSource === "markdown" ? "Supports .md files" : "Supports .html files"}
                      </p>
                    </div>
                  </>
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

                {(selectedSource === "markdown" || selectedSource === "html") && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-[var(--border-subtle)]">
                    <Button variant="ghost" onClick={() => {
                      setSelectedSource(null);
                      setUploadError(null);
                      setUploadSuccess(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}>
                      Cancel
                    </Button>
                    {isProcessing && (
                      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </div>
                    )}
                  </div>
                )}
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
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Document Export</h2>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">
              Export individual documents from the editor using the export button. Available formats:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {exportFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <div
                    key={format.id}
                    className="p-4 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--surface-card)]"
                  >
                    <Icon className="w-8 h-8 mb-3 text-[var(--text-tertiary)]" />
                    <h3 className="font-medium text-[var(--text-primary)]">{format.name}</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{format.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Export Documents</CardTitle>
              <CardDescription>Export individual documents directly from the editor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-[var(--surface-ground)] rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-[var(--brand-primary)]">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">Open a Document</p>
                    <p className="text-sm text-[var(--text-tertiary)]">Navigate to any document in your knowledge base</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--surface-ground)] rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-[var(--brand-primary)]">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">Click Export Button</p>
                    <p className="text-sm text-[var(--text-tertiary)]">Find the download icon in the editor toolbar (next to version history)</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--surface-ground)] rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-[var(--brand-primary)]">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">Choose Format</p>
                    <p className="text-sm text-[var(--text-tertiary)]">Select Markdown, Word (DOCX), or PDF from the export modal</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-sm text-[var(--text-tertiary)]">
                  <strong className="text-[var(--text-primary)]">Note:</strong> The export feature can be enabled or disabled by admins in the settings above.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

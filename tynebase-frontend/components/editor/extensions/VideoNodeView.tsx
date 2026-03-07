import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState } from 'react';
import { Sparkles, Loader2, Trash2, GripVertical, Save } from 'lucide-react';

export default function VideoNodeView({ node, selected, deleteNode }: NodeViewProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [outputOptions, setOutputOptions] = useState({
    generate_transcript: true,
    generate_summary: false,
    generate_article: false,
    append_to_document: true,
    ai_model: 'gemini',
  });
  const { src, title, videoType } = node.attrs;

  // Detect if this is a YouTube URL
  const isYouTube = src.includes('youtube.com') || src.includes('youtu.be');
  
  // Extract YouTube video ID
  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  const handleAddToRAGClick = () => {
    // Get document ID from URL path - format: /dashboard/knowledge/[id]
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const documentId = pathParts[pathParts.length - 1];
    
    // Validate UUID format - if not valid, document is not saved yet
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      setShowSaveModal(true);
      return;
    }

    // Show options modal
    setShowOptionsModal(true);
  };

  const handleStartTranscription = async () => {
    console.log('[VideoNodeView] Starting transcription with options:', JSON.stringify(outputOptions, null, 2));
    
    setShowOptionsModal(false);
    setIsTranscribing(true);
    try {
      // Get document ID from URL path
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const documentId = pathParts[pathParts.length - 1];

      // Get tenant subdomain from localStorage (same as API client)
      const tenantSubdomain = localStorage.getItem('tenant_subdomain');
      const accessToken = localStorage.getItem('access_token');

      if (!tenantSubdomain) {
        throw new Error('Tenant subdomain not found. Please refresh the page.');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${documentId}/transcribe-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'x-tenant-subdomain': tenantSubdomain,
        },
        body: JSON.stringify({
          video_url: src,
          video_type: videoType || (src.includes('youtube') ? 'youtube' : 'uploaded'),
          output_options: outputOptions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to transcribe video');
      }

      const result = await response.json();
      console.log('Video transcription started:', result);
      
      // Poll for job completion and reload when done
      const jobId = result.job_id;
      let timeoutId: ReturnType<typeof setTimeout>;
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'x-tenant-subdomain': tenantSubdomain,
            },
          });
          
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            const jobStatus = data.job || data; // Backend wraps in { job: {...} }
            if (jobStatus.status === 'completed') {
              clearInterval(pollInterval);
              clearTimeout(timeoutId);
              window.location.reload();
            } else if (jobStatus.status === 'failed') {
              clearInterval(pollInterval);
              clearTimeout(timeoutId);
              const errorMsg = jobStatus.error_message || 'Video transcription failed';
              console.error('Video transcription job failed:', errorMsg);
              setIsTranscribing(false);
              setShowMenu(false);
              setTranscribeError(`Video transcription failed: ${errorMsg}`);
            }
          }
        } catch (pollError) {
          console.error('Error polling job status:', pollError);
        }
      }, 3000); // Poll every 3 seconds
      
      // Fallback: stop polling after 120 seconds
      timeoutId = setTimeout(() => {
        clearInterval(pollInterval);
        setIsTranscribing(false);
        setShowMenu(false);
        setTranscribeError('Video transcription timed out. Please check the document and try again.');
      }, 120000);
      
    } catch (error) {
      console.error('Failed to transcribe video:', error);
      setTranscribeError(error instanceof Error ? error.message : 'Failed to transcribe video');
      setIsTranscribing(false);
      setShowMenu(false);
    }
  };

  return (
    <NodeViewWrapper className="video-node-wrapper">
      <div
        className={`relative group ${selected ? 'ring-2 ring-[var(--brand-primary)]' : ''}`}
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        {/* Drag Handle - always visible, acts as drag handle */}
        <div 
          data-drag-handle
          className="absolute -left-8 top-2 cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-5 h-5 text-[var(--text-tertiary)]" />
        </div>
        {/* Video or YouTube Embed */}
        {isYouTube ? (
          <iframe
            src={getYouTubeEmbedUrl(src)}
            title={title || 'YouTube video'}
            className="w-full rounded-lg"
            style={{ height: '400px' }}
            allow="fullscreen"
            allowFullScreen
          />
        ) : (
          <video
            src={src}
            title={title}
            controls
            preload="metadata"
            className="w-full rounded-lg"
            style={{ maxHeight: '500px' }}
          />
        )}

        {/* Hover Menu - positioned outside the iframe/video to avoid conflicts */}
        {!isTranscribing && (
          <div 
            className="absolute -top-12 right-0 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-lg p-1 z-50 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseEnter={() => setShowMenu(true)}
          >
            <button
              onClick={handleAddToRAGClick}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-md transition-colors whitespace-nowrap"
              title="Transcribe video and add to document"
            >
              <Sparkles className="w-4 h-4 text-[var(--brand-primary)]" />
              Add to RAG
            </button>
            <button
              onClick={deleteNode}
              className="flex items-center gap-1 px-2 py-2 text-sm text-red-600 hover:bg-red-500/10 rounded-md transition-colors"
              title="Delete video"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading Overlay with Progress */}
        {isTranscribing && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 select-none"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.preventDefault()}
            style={{ userSelect: 'none', pointerEvents: 'all' }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div 
              className="relative bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-8 max-w-md w-full"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-[var(--brand-primary)]" />
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Processing Video
                  </h3>
                </div>
                
                <div className="w-full space-y-3">
                  <p className="text-sm text-[var(--text-secondary)] text-center">
                    AI is analysing the video and generating your selected outputs...
                  </p>
                  
                  {/* Google-style rainbow progress bar */}
                  <div className="w-full h-1 rounded-full overflow-hidden">
                    <div className="h-full w-full rainbow-gradient" />
                  </div>
                  
                  <p className="text-xs text-[var(--text-tertiary)] text-center">
                    This may take 30-40 seconds. The page will refresh automatically.
                  </p>
                  
                  <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)] mt-4">
                    <span className="px-2 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded">
                      {10 + (outputOptions.generate_summary ? 2 : 0) + (outputOptions.generate_article ? 2 : 0)} credits
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Output Options Modal */}
        {showOptionsModal && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4" 
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowOptionsModal(false); }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div 
              className="relative bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Video Transcription Options
              </h3>
              
              <div className="space-y-4 mb-6">
                {/* Credit Cost Display */}
                <div className="bg-[var(--surface-ground)] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">Total Cost</span>
                    <span className="text-lg font-bold text-[var(--brand-primary)]">
                      {10 + (outputOptions.generate_summary ? 2 : 0) + (outputOptions.generate_article ? 2 : 0)} credits
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Base: 10 credits (Gemini transcription) • AI outputs: +2 credits each
                  </p>
                </div>

                {/* Output Options */}
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outputOptions.generate_transcript}
                      onChange={(e) => {
                        console.log('[VideoNodeView] Transcript checkbox changed:', e.target.checked);
                        setOutputOptions({...outputOptions, generate_transcript: e.target.checked});
                      }}
                      className="mt-1 w-4 h-4 rounded border-[var(--border-default)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-primary)]">Include Full Transcript in Document</div>
                      <div className="text-sm text-[var(--text-secondary)]">Add the complete transcript to your document</div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">Transcript is always generated for AI processing</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outputOptions.generate_summary}
                      onChange={(e) => setOutputOptions({...outputOptions, generate_summary: e.target.checked})}
                      className="mt-1 w-4 h-4 rounded border-[var(--border-default)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-primary)]">Summary</div>
                      <div className="text-sm text-[var(--text-secondary)]">AI-generated key points</div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">+2 credits</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outputOptions.generate_article}
                      onChange={(e) => setOutputOptions({...outputOptions, generate_article: e.target.checked})}
                      className="mt-1 w-4 h-4 rounded border-[var(--border-default)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-primary)]">Article</div>
                      <div className="text-sm text-[var(--text-secondary)]">Formatted documentation</div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">+2 credits</div>
                    </div>
                  </label>
                </div>

                {/* AI Model Selection */}
                {(outputOptions.generate_summary || outputOptions.generate_article) && (
                  <div className="pt-3 border-t border-[var(--border-subtle)]">
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      AI Provider for Summary/Article
                    </label>
                    <select
                      value={outputOptions.ai_model}
                      onChange={(e) => setOutputOptions({...outputOptions, ai_model: e.target.value})}
                      className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="gemini">Gemini 2.5 Flash</option>
                      <option value="deepseek">DeepSeek V3</option>
                      <option value="claude">Claude 3.5 Sonnet</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowOptionsModal(false)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartTranscription}
                  className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors font-medium"
                >
                  Start Transcription
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Document Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowSaveModal(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div 
              className="relative bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center">
                  <Save className="w-6 h-6 text-[var(--brand-primary)]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Save Document First
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Please save your document before adding videos to RAG. Click the Save button in the top right corner to create your document first.
                  </p>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowSaveModal(false)}
                      className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors text-sm font-medium"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

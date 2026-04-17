"use client";

import { useEffect, useCallback, useState } from 'react';
import { X, Clock, ArrowLeft, Calendar } from 'lucide-react';
import { DocArticle } from '@/lib/docs/types';
import { allArticles } from '@/lib/docs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocModalProps {
  article: DocArticle | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocModal({ article: initialArticle, isOpen, onClose }: DocModalProps) {
  const [article, setArticle] = useState<DocArticle | null>(initialArticle);
  
  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !article) return null;

  return (
    <div 
      className="fixed inset-0 z-40 flex items-start justify-center"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.6)', 
        backdropFilter: 'blur(4px)',
        paddingTop: '72px', // Below navbar
      }}
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl overflow-hidden mx-4 md:mx-6"
        style={{ 
          marginTop: '16px',
          marginBottom: '16px',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: 'calc(100vh - 72px - 32px)', // Full height minus navbar and margins
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header - compact on mobile */}
        <div 
          style={{ 
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: '16px 24px',
            background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
            borderBottom: '1px solid #e5e5e5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', paddingLeft: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                {/* Artistic gradient icon */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #E85002 0%, #9333ea 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <span 
                  style={{ 
                    padding: '6px 14px', 
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  {article.category}
                </span>
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#000000', lineHeight: 1.2, marginBottom: '8px', marginTop: 0 }}>
                {article.title}
              </h1>
              <p style={{ fontSize: '15px', color: '#666666', lineHeight: 1.5, marginBottom: 0, marginTop: 0 }}>
                {article.description}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                background: '#f5f5f5',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e5e5'}
              onMouseLeave={e => e.currentTarget.style.background = '#f5f5f5'}
            >
              <X style={{ width: '20px', height: '20px', color: '#666666' }} />
            </button>
          </div>
          
          {/* Meta info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', color: '#888888', fontSize: '13px', paddingLeft: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock style={{ width: '14px', height: '14px' }} />
              <span>{article.readTime}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar style={{ width: '14px', height: '14px' }} />
              <span>Updated {article.lastUpdated}</span>
            </div>
          </div>
          
          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', paddingLeft: '8px' }}>
            {article.tags.slice(0, 4).map(tag => (
              <span 
                key={tag}
                style={{ 
                  padding: '3px 8px', 
                  background: '#f0f0f0',
                  color: '#666666',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Content - flex-1 to take remaining space */}
        <div 
          style={{ 
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
            background: '#ffffff',
          }}
        >
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 style={{ 
                    fontSize: '26px', 
                    fontWeight: 700, 
                    color: '#111111', 
                    marginBottom: '20px', 
                    marginTop: '40px', 
                    lineHeight: 1.3,
                    letterSpacing: '-0.02em',
                    paddingLeft: '8px',
                  }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    marginTop: '40px', 
                    marginBottom: '20px',
                    paddingBottom: '12px',
                    paddingLeft: '8px',
                    borderBottom: '1px solid #eaeaea',
                  }}>
                    {/* Orange to purple gradient icon for h2 */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #E85002 0%, #9333ea 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4"/>
                        <path d="M12 8h.01"/>
                      </svg>
                    </div>
                    <h2 style={{ 
                      fontSize: '20px', 
                      fontWeight: 600, 
                      color: '#111111', 
                      lineHeight: 1.3,
                      letterSpacing: '-0.01em',
                      margin: 0,
                    }}>
                      {children}
                    </h2>
                  </div>
                ),
                h3: ({ children }) => (
                  <h3 style={{ 
                    fontSize: '17px', 
                    fontWeight: 600, 
                    color: '#222222', 
                    marginBottom: '12px', 
                    marginTop: '28px', 
                    lineHeight: 1.4,
                    letterSpacing: '-0.01em',
                    paddingLeft: '8px',
                  }}>
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p style={{ 
                    fontSize: '15px', 
                    color: '#444444', 
                    lineHeight: 1.8, 
                    marginBottom: '18px',
                    letterSpacing: '0.01em',
                    paddingLeft: '8px',
                  }}>
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul style={{ 
                    marginBottom: '20px', 
                    paddingLeft: '28px', 
                    listStyleType: 'disc',
                  }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ 
                    marginBottom: '20px', 
                    paddingLeft: '28px', 
                    listStyleType: 'decimal',
                  }}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li style={{ 
                    fontSize: '15px', 
                    color: '#444444', 
                    lineHeight: 1.8, 
                    marginBottom: '10px',
                    paddingLeft: '4px',
                  }}>
                    {children}
                  </li>
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)', 
                        padding: '4px 18px', 
                        borderRadius: '4px', 
                        fontSize: '13px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        lineHeight: '1.4'
                      }}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={className} {...props} style={{
                      display: 'block',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '13px',
                      color: '#e5e5e5',
                      padding: '0 8px',
                    }}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre style={{ 
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)', 
                    color: '#e5e5e5',
                    padding: '20px', 
                    borderRadius: '12px', 
                    marginBottom: '24px',
                    marginTop: '8px',
                    overflowX: 'auto',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    border: '1px solid #333',
                  }}>
                    {children}
                  </pre>
                ),
                table: ({ children }) => (
                  <div style={{ 
                    overflowX: 'auto', 
                    marginBottom: '20px',
                    marginTop: '12px',
                    borderRadius: '10px',
                    border: '1px solid #e2e4e9',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      fontSize: '13.5px',
                      lineHeight: '1.55',
                    }}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ 
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  }}>
                    {children}
                  </thead>
                ),
                th: ({ children }) => (
                  <th style={{ 
                    padding: '10px 16px', 
                    textAlign: 'left', 
                    fontWeight: 600,
                    color: '#ffffff',
                    fontSize: '11.5px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                    borderRight: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td style={{ 
                    padding: '9px 16px', 
                    borderTop: '1px solid #f0f0f2',
                    color: '#374151',
                    fontSize: '13.5px',
                    verticalAlign: 'top',
                  }}>
                    {children}
                  </td>
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{ 
                    borderLeft: '4px solid transparent',
                    borderImage: 'linear-gradient(135deg, #E85002, #9333ea) 1',
                    paddingLeft: '20px',
                    marginLeft: 0,
                    marginBottom: '20px',
                    marginTop: '8px',
                    fontStyle: 'italic',
                    color: '#555555',
                    background: 'linear-gradient(135deg, rgba(232, 80, 2, 0.03) 0%, rgba(147, 51, 234, 0.03) 100%)',
                    padding: '16px 20px',
                    borderRadius: '0 8px 8px 0',
                  }}>
                    {children}
                  </blockquote>
                ),
                hr: () => (
                  <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', margin: '32px 0' }} />
                ),
                a: ({ href, children }) => {
                  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (href?.startsWith('/docs/')) {
                      e.preventDefault();
                      const slug = href.split('/').pop();
                      const targetArticle = allArticles.find((a: DocArticle) => a.slug === slug);
                      if (targetArticle) {
                        setArticle(targetArticle);
                      }
                    }
                  };
                  return (
                    <a 
                      href={href} 
                      onClick={handleClick}
                      style={{ 
                        color: '#E85002', 
                        textDecoration: 'none', 
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      {children}
                    </a>
                  );
                },
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 600, color: '#000000' }}>{children}</strong>
                ),
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer - compact on mobile */}
        <div 
          className="px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-4"
          style={{ 
            background: '#fafafa',
            borderTop: '1px solid #e5e5e5',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              color: '#666666',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f5f5f5';
              e.currentTarget.style.borderColor = '#cccccc';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = '#e5e5e5';
            }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Back to Documentation
          </button>
          
          <div className="hidden md:flex items-center gap-2" style={{ color: '#888888', fontSize: '13px' }}>
            <span>Was this helpful?</span>
            <button 
              style={{ padding: '6px 12px', background: '#f0f0f0', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e5e5'}
              onMouseLeave={e => e.currentTarget.style.background = '#f0f0f0'}
              onClick={e => {
                const button = e.currentTarget;
                button.style.transform = 'translateY(-4px)';
                setTimeout(() => {
                  button.style.transform = 'translateY(0)';
                }, 200);
              }}
            >
              👍
            </button>
            <button 
              style={{ padding: '6px 12px', background: '#f0f0f0', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e5e5'}
              onMouseLeave={e => e.currentTarget.style.background = '#f0f0f0'}
              onClick={e => {
                const button = e.currentTarget;
                button.style.transform = 'translateY(-4px)';
                setTimeout(() => {
                  button.style.transform = 'translateY(0)';
                }, 200);
              }}
            >
              👎
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

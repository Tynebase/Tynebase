"use client";

import { useEffect, useCallback } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { DocArticle } from '@/lib/docs/types';

interface CategoryModalProps {
  categoryTitle: string;
  articles: DocArticle[];
  isOpen: boolean;
  onClose: () => void;
  onSelectArticle: (article: DocArticle) => void;
}

export function CategoryModal({ categoryTitle, articles, isOpen, onClose, onSelectArticle }: CategoryModalProps) {
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-40 flex items-start justify-center"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.6)', 
        backdropFilter: 'blur(4px)',
        paddingTop: '72px',
      }}
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl overflow-hidden mx-4 md:mx-6"
        style={{ 
          marginTop: '16px',
          marginBottom: '16px',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: 'calc(100vh - 72px - 32px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{ 
            padding: '20px 32px',
            background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
            borderBottom: '1px solid #e5e5e5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#000000', lineHeight: 1.2, margin: 0 }}>
                {categoryTitle}
              </h2>
              <p style={{ fontSize: '14px', color: '#666666', marginTop: '8px', marginBottom: 0 }}>
                {articles.length} article{articles.length !== 1 ? 's' : ''}
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
        </div>

        {/* Articles List */}
        <div 
          style={{ 
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {articles.map((article) => (
              <button
                key={article.id}
                onClick={() => {
                  onSelectArticle(article);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '20px',
                  background: '#fafafa',
                  border: '1px solid #e5e5e5',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#E85002';
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e5e5e5';
                  e.currentTarget.style.background = '#fafafa';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#000000', marginBottom: '8px', marginTop: 0 }}>
                  {article.title}
                </h3>
                <p style={{ fontSize: '14px', color: '#666666', marginBottom: '12px', marginTop: 0, lineHeight: 1.5 }}>
                  {article.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#888888' }}>
                  <span>{article.readTime} read</span>
                  <span>•</span>
                  <span>Updated {article.lastUpdated}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div 
          style={{ 
            padding: '16px 32px',
            background: '#fafafa',
            borderTop: '1px solid #e5e5e5',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

interface MarkdownReaderProps {
  content: string;
  title?: string;
  id?: string;
}

export function MarkdownReader({ content, title, id }: MarkdownReaderProps) {
  const slugCounts = new Map<string, number>();

  const toSlug = (input: string) =>
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const plainText = (children: React.ReactNode): string => {
    if (typeof children === "string") return children;
    if (typeof children === "number") return String(children);
    if (Array.isArray(children)) return children.map((c) => plainText(c)).join("");
    if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
      return plainText(children.props.children);
    }
    return "";
  };

  const getHeadingId = (children: React.ReactNode) => {
    const text = plainText(children);
    const base = toSlug(text);
    if (!base) return undefined;
    const next = (slugCounts.get(base) ?? 0) + 1;
    slugCounts.set(base, next);
    return next === 1 ? base : `${base}-${next}`;
  };

  return (
    <div 
      id={id}
      className="bg-[var(--surface-ground)] rounded-xl overflow-hidden"
    >
      {/* Document Container - full height */}
      <div 
        id={id ? `${id}-scroll` : undefined}
        className="w-full shadow-xl rounded-sm"
        style={{
          backgroundColor: 'var(--surface-card)',
        }}
      >
        {/* Document Content */}
        <div className="px-8 md:px-16 py-8 md:py-12">
          {title && (
            <h1 className="text-3xl font-bold mb-8 pb-4 border-b" style={{ color: 'var(--dash-text-primary)', borderColor: 'var(--dash-border-default)' }}>
              {title}
            </h1>
          )}
          <div className="prose prose-lg max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              h1: ({ children }) => (
                <h1
                  id={getHeadingId(children)}
                  className="text-3xl font-bold mt-0 mb-4 scroll-mt-24"
                  style={{ color: 'var(--dash-text-primary)' }}
                >
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2
                  id={getHeadingId(children)}
                  className="text-2xl font-bold mt-8 mb-3 scroll-mt-24"
                  style={{ color: 'var(--dash-text-primary)' }}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  id={getHeadingId(children)}
                  className="text-xl font-semibold mt-6 mb-2 scroll-mt-24"
                  style={{ color: 'var(--dash-text-primary)' }}
                >
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-[15px] leading-7 mb-4" style={{ color: 'var(--dash-text-secondary)' }}>
                  {children}
                </p>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  className="hover:underline"
                  style={{ color: 'var(--brand)' }}
                  target="_blank"
                  rel="noreferrer"
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-6 text-[15px] mb-4 space-y-1" style={{ color: 'var(--dash-text-secondary)' }}>
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-6 text-[15px] mb-4 space-y-1" style={{ color: 'var(--dash-text-secondary)' }}>
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-7">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 rounded-xl px-4 py-3 my-5" style={{ borderColor: 'var(--brand)', backgroundColor: 'var(--brand-primary-muted)', color: 'var(--dash-text-secondary)' }}>
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="px-2 py-0.5 rounded-md text-[13px]" style={{ backgroundColor: 'var(--surface-ground)', borderWidth: '1px', borderColor: 'var(--dash-border-subtle)', color: 'var(--dash-text-primary)' }}>
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="rounded-xl p-4 overflow-auto mb-5 text-[13px]" style={{ backgroundColor: 'var(--surface-ground)', borderWidth: '1px', borderColor: 'var(--dash-border-subtle)' }}>
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="overflow-auto mb-5">
                  <table className="w-full rounded-xl overflow-hidden" style={{ borderWidth: '1px', borderColor: 'var(--dash-border-default)' }}>
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead style={{ backgroundColor: 'var(--surface-ground)', borderBottomWidth: '1px', borderColor: 'var(--dash-border-default)' }}>
                  {children}
                </thead>
              ),
              th: ({ children }) => (
                <th className="text-left text-xs font-semibold px-3 py-2" style={{ color: 'var(--dash-text-tertiary)' }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="text-sm px-3 py-2" style={{ color: 'var(--dash-text-secondary)', borderTopWidth: '1px', borderColor: 'var(--dash-border-subtle)' }}>
                  {children}
                </td>
              ),
              hr: () => <hr className="my-6" style={{ borderColor: 'var(--dash-border-default)' }} />,
            }}
          >
            {content}
          </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

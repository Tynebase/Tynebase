"use client";

/**
 * Supabase-style documentation viewer.
 *
 * Three-column layout: collapsible category sidebar, center article, right "On this page" TOC
 * with scroll-spy. Reusable for both the TyneBase platform docs and tenant KB articles.
 *
 * Content is rendered from Markdown via `marked`. Heading IDs are generated from a slugified
 * version of the heading text so the TOC anchors line up with the rendered DOM.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { marked } from "marked";

// ---------- Types ----------

export interface DocsNavArticle {
  slug: string;
  title: string;
  /** Optional href override — if omitted, uses `${basePath}?slug=${slug}`. */
  href?: string;
}

export interface DocsNavSection {
  id: string;
  title: string;
  icon?: LucideIcon;
  articles: DocsNavArticle[];
  defaultOpen?: boolean;
}

export interface DocsLayoutProps {
  /** Category groupings shown in the left sidebar. */
  sections: DocsNavSection[];
  /** Slug of the currently viewed article — used for sidebar active state. */
  currentSlug: string;
  /** Article title shown as H1. */
  title: string;
  /** Optional subtitle / description under the H1. */
  description?: string;
  /** Raw markdown body. */
  content: string;
  /** Optional meta pills rendered above the title (category, read time, updated date, etc). */
  meta?: { label: string; value: string; color?: string }[];
  /** Base route for sidebar links when the article doesn't specify an absolute href. */
  basePath?: string;
  /** Rendered above the three-column layout — defaults to nothing so callers can supply their own navbar. */
  header?: React.ReactNode;
  /** Rendered below the three-column layout — defaults to nothing. */
  footer?: React.ReactNode;
  /** Optional breadcrumb e.g. "Documentation / Getting Started". */
  breadcrumbs?: { label: string; href?: string }[];
  /** Rendered inside the center column immediately after the markdown body — ideal for feedback widgets, related-doc lists, etc. */
  afterContent?: React.ReactNode;
}

// ---------- Utilities ----------

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Convert markdown to HTML and simultaneously collect h2/h3 headings for the TOC.
 * Heading IDs are slugified from the raw heading text, matching what the TOC anchors
 * link to. Image syntax `![alt|Npx](url)` is pre-processed into sized <img> tags (the
 * same convention used elsewhere in the app so existing docs render correctly).
 */
function renderMarkdown(md: string): { html: string; toc: TocEntry[] } {
  if (!md) return { html: "", toc: [] };

  // Preserve sized-image syntax used throughout existing platform docs.
  const preprocessed = md.replace(
    /!\[([^\]]*?)(?:\|(\d+)px)?\]\(([^)]+)\)/g,
    (_match, alt, width, src) => {
      const widthAttr = width ? ` style="max-width:${width}px"` : "";
      return `<img src="${src}" alt="${alt}"${widthAttr} />`;
    }
  );

  const toc: TocEntry[] = [];
  const renderer = new marked.Renderer();

  const originalHeading = renderer.heading.bind(renderer);
  renderer.heading = (token: any) => {
    const text: string = typeof token === "object" ? token.text : String(token);
    const level: number = typeof token === "object" ? token.depth : 2;
    const id = slugifyHeading(text);
    if (level === 2 || level === 3) {
      toc.push({ id, text, level: level as 2 | 3 });
    }
    // Fall back to default rendering but inject the id.
    try {
      const rendered = originalHeading({ ...token, text, depth: level } as any);
      return rendered.replace(/^<h(\d)>/, `<h$1 id="${id}">`);
    } catch {
      return `<h${level} id="${id}">${text}</h${level}>`;
    }
  };

  marked.setOptions({ gfm: true, breaks: false });
  const html = marked.parse(preprocessed, { renderer }) as string;
  return { html: typeof html === "string" ? html : "", toc };
}

// ---------- Sidebar ----------

function DocsSidebar({
  sections,
  currentSlug,
  basePath,
}: {
  sections: DocsNavSection[];
  currentSlug: string;
  basePath: string;
}) {
  // A section is open by default if it contains the active slug, is marked defaultOpen,
  // or there's no active slug and it's the first section.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    sections.forEach((s, i) => {
      const hasActive = s.articles.some((a) => a.slug === currentSlug);
      state[s.id] = hasActive || s.defaultOpen || (!currentSlug && i === 0);
    });
    return state;
  });

  // If currentSlug changes to something in a collapsed section, auto-open it.
  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev };
      sections.forEach((s) => {
        if (s.articles.some((a) => a.slug === currentSlug)) next[s.id] = true;
      });
      return next;
    });
  }, [currentSlug, sections]);

  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const hrefFor = (article: DocsNavArticle) =>
    article.href ?? `${basePath}?slug=${encodeURIComponent(article.slug)}`;

  return (
    <aside
        className="docs-sidebar"
        style={{
          position: "sticky",
          top: "80px",
          alignSelf: "flex-start",
          width: "260px",
          flexShrink: 0,
          height: "calc(100vh - 80px)",
          overflowY: "auto",
          padding: "24px 16px 48px 0",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <nav>
          {sections.map((section) => {
            const Icon = section.icon;
            const isOpen = !!openSections[section.id];
            return (
              <div key={section.id} style={{ marginBottom: "4px" }}>
                <button
                  onClick={() => toggleSection(section.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  )}
                  {Icon && <Icon className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />}
                  <span>{section.title}</span>
                </button>

                {isOpen && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "2px 0 8px 0" }}>
                    {section.articles.map((article) => {
                      const active = article.slug === currentSlug;
                      return (
                        <li key={article.slug}>
                          <Link
                            href={hrefFor(article)}
                            style={{
                              display: "block",
                              padding: "6px 10px 6px 34px",
                              borderRadius: "6px",
                              fontSize: "13px",
                              color: active ? "var(--brand)" : "var(--text-secondary)",
                              background: active ? "var(--brand-faint, rgba(16,185,129,0.08))" : "transparent",
                              borderLeft: active
                                ? "2px solid var(--brand)"
                                : "2px solid transparent",
                              marginLeft: "10px",
                              textDecoration: "none",
                              transition: "background 0.15s, color 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              if (!active) {
                                e.currentTarget.style.background = "var(--bg-hover)";
                                e.currentTarget.style.color = "var(--text-primary)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!active) {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "var(--text-secondary)";
                              }
                            }}
                          >
                            {article.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
  );
}

// ---------- Right-rail TOC ----------

function DocsTOC({ toc }: { toc: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll-spy: whichever heading is nearest to the top of the viewport wins.
  useEffect(() => {
    if (!toc.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    toc.forEach((entry) => {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  // Keep the active TOC entry in view when the list itself scrolls (long docs).
  useEffect(() => {
    if (!activeId || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`a[data-toc-id="${activeId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeId]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const top = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: "smooth" });
    // Reflect the jump in the URL without triggering the default hash jump.
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  if (!toc.length) return <div style={{ width: "240px", flexShrink: 0 }} />;

  return (
    <aside
      className="docs-toc"
      style={{
        position: "sticky",
        top: "88px",
        alignSelf: "flex-start",
        width: "240px",
        flexShrink: 0,
        maxHeight: "calc(100vh - 104px)",
        overflowY: "auto",
        padding: "20px 16px",
        marginLeft: "16px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "12px",
        boxShadow: "0 4px 20px -12px rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "14px",
          paddingLeft: "10px",
        }}
      >
        On this page
      </div>
      <ul ref={listRef} style={{ listStyle: "none", padding: 0, margin: 0, position: "relative" }}>
        {toc.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                data-toc-id={entry.id}
                onClick={(e) => handleClick(e, entry.id)}
                style={{
                  position: "relative",
                  display: "block",
                  padding: "6px 10px",
                  paddingLeft: entry.level === 3 ? "22px" : "10px",
                  fontSize: "13px",
                  lineHeight: 1.45,
                  borderRadius: "6px",
                  color: active ? "var(--brand)" : "var(--text-secondary)",
                  background: active ? "var(--brand-faint, rgba(16,185,129,0.08))" : "transparent",
                  fontWeight: active ? 600 : 400,
                  textDecoration: "none",
                  transition: "color 0.18s ease, background 0.18s ease, transform 0.18s ease",
                  transform: active ? "translateX(2px)" : "translateX(0)",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "var(--text-primary)";
                    e.currentTarget.style.background = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "var(--text-secondary)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ---------- Main layout ----------

export function DocsLayout({
  sections,
  currentSlug,
  title,
  description,
  content,
  meta,
  basePath = "/docs",
  header,
  footer,
  breadcrumbs,
  afterContent,
}: DocsLayoutProps) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);

  const { html, toc } = useMemo(() => renderMarkdown(content), [content]);

  // Scroll to top when navigating between articles.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [currentSlug, pathname]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {header}

      <div
        className="docs-layout-shell"
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "flex-start",
          gap: "40px",
        }}
      >
        {/* Sidebar — hidden on narrow viewports. Wrapper stretches so the sticky
            inner aside has scroll range across the full article. */}
        <div className="docs-sidebar-wrap hidden-mobile" style={{ display: "block", alignSelf: "stretch" }}>
          <DocsSidebar
            sections={sections}
            currentSlug={currentSlug}
            basePath={basePath}
          />
        </div>

        {/* Center column */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: "32px 0 96px",
            maxWidth: "760px",
          }}
        >
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexWrap: "wrap",
                marginBottom: "16px",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              {breadcrumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {c.href ? (
                    <Link
                      href={c.href}
                      style={{ color: "var(--text-muted)", textDecoration: "none" }}
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span>{c.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          <h1
            style={{
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "var(--text-primary)",
              margin: "0 0 16px",
            }}
          >
            {title}
          </h1>

          {description && (
            <p
              style={{
                fontSize: "18px",
                lineHeight: 1.55,
                color: "var(--text-secondary)",
                margin: "0 0 24px",
              }}
            >
              {description}
            </p>
          )}

          {meta && meta.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "32px",
                paddingBottom: "24px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              {meta.map((m, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: m.color ? `${m.color}20` : "var(--bg-secondary)",
                    color: m.color || "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{m.label}:</span>
                  <span>{m.value}</span>
                </span>
              ))}
            </div>
          )}

          <div
            ref={contentRef}
            className="docs-prose"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {afterContent}
        </main>

        {/* Right rail TOC — wrapper stretches to the main column's height so the
            inner `position: sticky` aside has scroll range to stick against. */}
        <div className="hidden-mobile" style={{ display: "block", alignSelf: "stretch" }}>
          <DocsTOC toc={toc} />
        </div>
      </div>

      {footer}

      <style jsx global>{`
        @media (max-width: 1023px) {
          .docs-layout-shell .hidden-mobile {
            display: none !important;
          }
        }

        .docs-prose {
          color: var(--text-secondary);
          font-size: 16px;
          line-height: 1.7;
        }
        .docs-prose h1,
        .docs-prose h2,
        .docs-prose h3,
        .docs-prose h4 {
          color: var(--text-primary);
          font-weight: 700;
          letter-spacing: -0.01em;
          scroll-margin-top: 90px;
        }
        .docs-prose h2 {
          font-size: 26px;
          margin: 48px 0 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .docs-prose h3 {
          font-size: 20px;
          margin: 36px 0 12px;
        }
        .docs-prose h4 {
          font-size: 17px;
          margin: 28px 0 10px;
        }
        .docs-prose p {
          margin: 0 0 20px;
        }
        .docs-prose a {
          color: var(--brand);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s;
        }
        .docs-prose a:hover {
          border-bottom-color: var(--brand);
        }
        .docs-prose strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        .docs-prose ul,
        .docs-prose ol {
          margin: 0 0 20px;
          padding-left: 24px;
        }
        .docs-prose li {
          margin: 6px 0;
        }
        .docs-prose code {
          background: var(--bg-secondary);
          color: var(--text-primary);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.9em;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          border: 1px solid var(--border-subtle);
        }
        .docs-prose pre {
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 16px 20px;
          overflow-x: auto;
          margin: 20px 0;
          font-size: 13px;
          line-height: 1.6;
        }
        .docs-prose pre code {
          background: transparent;
          border: none;
          padding: 0;
          font-size: inherit;
        }
        .docs-prose blockquote {
          border-left: 3px solid var(--brand);
          background: var(--bg-secondary);
          margin: 20px 0;
          padding: 12px 20px;
          color: var(--text-secondary);
          border-radius: 0 6px 6px 0;
        }
        .docs-prose img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 24px 0;
          border: 1px solid var(--border-subtle);
        }
        .docs-prose table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          font-size: 14px;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          overflow: hidden;
        }
        .docs-prose th,
        .docs-prose td {
          padding: 10px 14px;
          text-align: left;
          border-bottom: 1px solid var(--border-subtle);
        }
        .docs-prose th {
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-weight: 600;
          font-size: 13px;
        }
        .docs-prose tr:last-child td {
          border-bottom: none;
        }
        .docs-prose hr {
          border: none;
          border-top: 1px solid var(--border-subtle);
          margin: 40px 0;
        }
      `}</style>
    </div>
  );
}

/**
 * Helper: build sidebar sections from the platform doc categories array.
 * Keeps call sites in docs pages short.
 */
export function buildSectionsFromCategories(
  categories: Array<{
    id: string;
    title: string;
    icon?: any;
    articles: Array<{ slug: string; title: string }>;
  }>,
  iconMap?: Record<string, LucideIcon>
): DocsNavSection[] {
  return categories.map((c) => ({
    id: c.id,
    title: c.title,
    icon: iconMap && typeof c.icon === "string" ? iconMap[c.icon] : undefined,
    articles: c.articles.map((a) => ({ slug: a.slug, title: a.title })),
  }));
}

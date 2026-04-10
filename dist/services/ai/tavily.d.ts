export interface TavilyScrapResult {
    url: string;
    title: string;
    markdown: string;
    rawContent: string;
}
/**
 * Scrape a URL using Tavily API and convert to markdown
 * @param url - The URL to scrape
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Scraped content as markdown
 */
export declare function scrapeUrlToMarkdown(url: string, timeout?: number): Promise<TavilyScrapResult>;
//# sourceMappingURL=tavily.d.ts.map
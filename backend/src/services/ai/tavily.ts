import { tavily } from '@tavily/core';
import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

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
export async function scrapeUrlToMarkdown(
  url: string,
  timeout: number = 10000
): Promise<TavilyScrapResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY environment variable is not set');
  }

  const tvly = tavily({ apiKey });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await tvly.extract([url]);

    clearTimeout(timeoutId);

    if (!response || !response.results || response.results.length === 0) {
      throw new Error('No content extracted from URL');
    }

    const result = response.results[0];
    
    const rawContent = result.rawContent || '';
    const markdown = turndownService.turndown(rawContent);

    return {
      url: result.url || url,
      title: result.title || 'Untitled',
      markdown,
      rawContent,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

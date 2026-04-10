"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeUrlToMarkdown = scrapeUrlToMarkdown;
const core_1 = require("@tavily/core");
const turndown_1 = __importDefault(require("turndown"));
const turndownService = new turndown_1.default({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
});
/**
 * Scrape a URL using Tavily API and convert to markdown
 * @param url - The URL to scrape
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Scraped content as markdown
 */
async function scrapeUrlToMarkdown(url, timeout = 10000) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        throw new Error('TAVILY_API_KEY environment variable is not set');
    }
    const tvly = (0, core_1.tavily)({ apiKey });
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
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
    }
}
//# sourceMappingURL=tavily.js.map
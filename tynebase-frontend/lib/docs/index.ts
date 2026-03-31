import { DocArticle } from './types';
import { quickStartArticles } from './quick-start';
import { aiFeatureArticles } from './ai-features';
import { coreConceptsArticles } from './core-concepts';
import { securityArticles } from './security';
import { apiReferenceArticles } from './api-reference';
import { brandingArticles } from './branding';
import { billingArticles } from './billing';

export * from './types';

export const allArticles: DocArticle[] = [
  ...quickStartArticles,
  ...aiFeatureArticles,
  ...coreConceptsArticles,
  ...securityArticles,
  ...apiReferenceArticles,
  ...brandingArticles,
  ...billingArticles,
];

export const categories = [
  {
    id: 'quick-start',
    slug: 'quick-start',
    title: 'Quick start',
    description: 'Get up and running with TyneBase in under 5 minutes.',
    icon: 'Zap',
    color: 'brand',
    articles: quickStartArticles,
  },
  {
    id: 'core-concepts',
    slug: 'core-concepts',
    title: 'Core Concepts',
    description: 'Understand workspaces, documents, and how TyneBase works.',
    icon: 'BookOpen',
    color: 'blue',
    articles: coreConceptsArticles,
  },
  {
    id: 'ai-features',
    slug: 'ai-features',
    title: 'AI Features',
    description: 'Generate docs from videos, prompts, and use AI search.',
    icon: 'Bot',
    color: 'purple',
    articles: aiFeatureArticles,
  },
  {
    id: 'branding',
    slug: 'branding',
    title: 'Branding & White-Label',
    description: 'Customize your workspace with your company\'s branding.',
    icon: 'Palette',
    color: 'pink',
    articles: brandingArticles,
  },
  {
    id: 'billing',
    slug: 'billing',
    title: 'Billing & Plans',
    description: 'Pricing plans, billing cycles, and payment options.',
    icon: 'CreditCard',
    color: 'green',
    articles: billingArticles,
  },
  {
    id: 'security',
    slug: 'security',
    title: 'Security & Compliance',
    description: 'SSO, GDPR, SOC 2, and enterprise security features.',
    icon: 'Shield',
    color: 'brand',
    articles: securityArticles,
  },
  {
    id: 'api-reference',
    slug: 'api-reference',
    title: 'API Reference',
    description: 'REST API documentation and integration guides.',
    icon: 'Code',
    color: 'cyan',
    articles: apiReferenceArticles,
  },
];

export function searchDocs(query: string): DocArticle[] {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/).filter(w => w.length > 2);
  
  return allArticles
    .map(article => {
      let score = 0;
      const lowerTitle = article.title.toLowerCase();
      const lowerDesc = article.description.toLowerCase();
      const lowerContent = article.content.toLowerCase();
      const lowerTags = article.tags.join(' ').toLowerCase();
      
      // Exact title match (highest priority)
      if (lowerTitle.includes(lowerQuery)) score += 100;
      
      // Word matches in title
      words.forEach(word => {
        if (lowerTitle.includes(word)) score += 20;
      });
      
      // Exact description match
      if (lowerDesc.includes(lowerQuery)) score += 50;
      
      // Word matches in description
      words.forEach(word => {
        if (lowerDesc.includes(word)) score += 10;
      });
      
      // Tag matches
      words.forEach(word => {
        if (lowerTags.includes(word)) score += 15;
      });
      
      // Content matches (lower priority)
      words.forEach(word => {
        if (lowerContent.includes(word)) score += 5;
      });
      
      return { article, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(item => item.article);
}

export function getArticleBySlug(slug: string): DocArticle | undefined {
  return allArticles.find(article => article.slug === slug);
}

export function getArticlesByCategory(categorySlug: string): DocArticle[] {
  const category = categories.find(c => c.slug === categorySlug);
  return category?.articles || [];
}

export function getCategoryBySlug(slug: string) {
  return categories.find(c => c.slug === slug);
}

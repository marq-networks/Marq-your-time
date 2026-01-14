
export type UrlCategory = 
  | 'Work-related'
  | 'Social Media'
  | 'News & Media'
  | 'Entertainment'
  | 'E-commerce'
  | 'Adult Content'
  | 'Search Engine'
  | 'Development'
  | 'Communication'
  | 'Uncategorized'

// Keyword mapping for categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Social Media': ['facebook', 'twitter', 'instagram', 'linkedin', 'reddit', 'tiktok', 'pinterest', 'snapchat', 'whatsapp', 'telegram'],
  'News & Media': ['bbc', 'cnn', 'nytimes', 'forbes', 'bloomberg', 'reuters', 'theguardian', 'huffpost', 'foxnews', 'wsj', 'washingtonpost', 'medium'],
  'Entertainment': ['youtube', 'netflix', 'spotify', 'twitch', 'hulu', 'disneyplus', 'primevideo', 'soundcloud', 'dailymotion', 'vimeo', 'steam', 'xbox', 'playstation'],
  'E-commerce': ['amazon', 'ebay', 'walmart', 'target', 'aliexpress', 'shopify', 'bestbuy', 'etsy', 'ikea', 'homedepot'],
  'Development': ['github', 'gitlab', 'stackoverflow', 'bitbucket', 'jira', 'confluence', 'trello', 'asana', 'notion', 'linear', 'vercel', 'netlify', 'aws', 'azure', 'google cloud', 'firebase', 'docker', 'kubernetes', 'localhost', '127.0.0.1'],
  'Communication': ['gmail', 'outlook', 'slack', 'discord', 'zoom', 'meet.google', 'teams.microsoft', 'skype'],
  'Search Engine': ['google', 'bing', 'duckduckgo', 'yahoo', 'baidu', 'yandex'],
  'Adult Content': ['pornhub', 'xhamster', 'xvideos', 'onlyfans'] // Minimal list for example
}

// Priority order for matching (if keywords overlap, though specific domain matching is better)
const PRIORITY: UrlCategory[] = [
  'Development',
  'Communication',
  'Work-related', // Fallback for specific work domains
  'Adult Content',
  'Social Media',
  'Entertainment',
  'News & Media',
  'E-commerce',
  'Search Engine'
]

export function categorizeUrl(url: string): UrlCategory {
  if (!url) return 'Uncategorized'

  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    const hostname = urlObj.hostname.toLowerCase()
    const pathname = urlObj.pathname.toLowerCase()

    // 1. Exact domain matching (or contains)
    for (const cat of PRIORITY) {
       const keywords = CATEGORY_KEYWORDS[cat]
       if (keywords) {
         for (const kw of keywords) {
           if (hostname.includes(kw)) {
             return cat as UrlCategory
           }
         }
       }
    }

    // 2. Fallback: Common patterns
    if (hostname.endsWith('.gov') || hostname.endsWith('.edu')) {
      return 'Work-related' // Assumption
    }

    return 'Uncategorized'

  } catch (e) {
    // If URL parsing fails, try simple string matching
    const lowerUrl = url.toLowerCase()
    for (const cat of PRIORITY) {
       const keywords = CATEGORY_KEYWORDS[cat]
       if (keywords) {
         for (const kw of keywords) {
           if (lowerUrl.includes(kw)) {
             return cat as UrlCategory
           }
         }
       }
    }
    return 'Uncategorized'
  }
}

import { OrgCategoryRule } from './types'

export function getProductivityStatus(category: string, rules?: OrgCategoryRule[]): 'productive' | 'unproductive' | 'neutral' {
  if (rules) {
    const rule = rules.find(r => r.categoryKey === category)
    if (rule) return rule.productivityStatus
  }
  
  switch (category) {
    case 'Development':
    case 'Work-related':
    case 'Communication':
      return 'productive'
    case 'Social Media':
    case 'Entertainment':
    case 'Adult Content':
      return 'unproductive'
    case 'News & Media':
    case 'E-commerce':
      return 'neutral' // Could be unproductive depending on org
    case 'Search Engine':
      return 'neutral'
    default:
      return 'neutral'
  }
}

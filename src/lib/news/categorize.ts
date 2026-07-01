/** Keyword-based classification into the dashboard's category buckets + a sector tag. */
import type { NewsCategory } from './types';

const CATEGORY_KEYWORDS: [NewsCategory, RegExp][] = [
  ['Federal Reserve', /\b(federal reserve|fomc|fed chair|powell|rate decision|central bank)\b/i],
  ['Interest Rates', /\b(interest rates?|rate hikes?|rate cuts?|basis points|treasury yield|bond yield)\b/i],
  ['Inflation', /\b(inflation|\bcpi\b|\bppi\b|\bpce\b|consumer prices|producer prices)\b/i],
  ['Employment', /\b(nonfarm payrolls|jobs report|unemployment|jobless claims|labor market|hiring)\b/i],
  ['Earnings', /\b(earnings|eps|revenue|quarterly results|guidance|beats estimates|misses estimates)\b/i],
  ['Analyst Upgrades', /\b(upgrade[ds]?|initiates? .*(buy|outperform|overweight))\b/i],
  ['Analyst Downgrades', /\b(downgrade[ds]?|initiates? .*(sell|underperform|underweight))\b/i],
  ['Mergers & Acquisitions', /\b(merger|acquisition|acquires?|to acquire|takeover|buyout|deal to buy)\b/i],
  ['FDA Announcements', /\b(fda|clinical trial|drug approval|phase [123]|biologics|recall)\b/i],
  ['SEC Filings', /\b(sec filing|8-k|10-q|10-k|s-1|13d|13g|prospectus)\b/i],
  ['Insider Buying/Selling', /\b(insider (buy|sell|buying|selling)|form 4|director (bought|sold))\b/i],
  ['AI', /\b(artificial intelligence|\bai\b|machine learning|large language model|\bllm\b|generative ai|chatgpt|copilot)\b/i],
  ['Crypto', /\b(crypto|bitcoin|ethereum|blockchain|stablecoin|\bbtc\b|\beth\b|defi)\b/i],
  ['Technology', /\b(software|semiconductor|chip|cloud computing|cybersecurity|smartphone|tech giant)\b/i],
  ['Energy', /\b(crude oil|opec|natural gas|energy prices|oil prices|barrel|renewable energy|solar|drilling)\b/i],
  ['Healthcare', /\b(healthcare|pharma|biotech|hospital|insurer|medicare|medicaid)\b/i],
  ['Financials', /\b(bank|banking|lender|insurer|asset manager|hedge fund|credit rating)\b/i],
  ['Consumer', /\b(retail sales|consumer spending|consumer confidence|e-commerce|retailer)\b/i],
  ['Economic News', /\b(gdp|economic growth|pmi|ism|retail sales|trade deficit|treasury auction|budget deficit)\b/i],
];

const SECTOR_BY_CATEGORY: Partial<Record<NewsCategory, string>> = {
  Technology: 'Technology',
  AI: 'Technology',
  Energy: 'Energy',
  Healthcare: 'Healthcare',
  Financials: 'Financials',
  Consumer: 'Consumer',
  Crypto: 'Crypto',
};

/** Returns every matching category (a story can appear in multiple groups), plus a sector tag. */
export function categorize(text: string): { categories: NewsCategory[]; sector: string | null } {
  const matches = CATEGORY_KEYWORDS.filter(([, re]) => re.test(text)).map(([cat]) => cat);
  const categories = matches.length > 0 ? matches : (['Market News'] as NewsCategory[]);
  const sector = categories.map((c) => SECTOR_BY_CATEGORY[c]).find((s) => s) ?? null;
  return { categories, sector };
}

const Item = require('../models/Item');
const notificationService = require('./notificationService');

// Stop words to ignore during tokenization
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself',
]);

/**
 * Tokenize string into significant lowercase keywords
 */
function extractKeywords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * Calculate Jaccard similarity or intersection score between two keyword sets
 */
function keywordOverlap(wordsA, wordsB) {
  if (!wordsA.length || !wordsB.length) return { score: 0, matches: [] };
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const common = [...setA].filter((w) => setB.has(w));
  const union = new Set([...setA, ...setB]);
  return {
    score: common.length / union.size,
    matches: common,
  };
}

const matchingService = {
  /**
   * Find potential matches for a given item
   * If item is 'lost', search for 'found' items, and vice versa.
   * Returns sorted array of matching items with scores and reasons.
   */
  async findMatches(targetItem, limit = 5) {
    if (!targetItem) return [];

    const oppositeType = targetItem.type === 'lost' ? 'found' : 'lost';

    // Find candidate opposite items that are active
    const candidates = await Item.find({
      _id: { $ne: targetItem._id },
      type: oppositeType,
      status: { $in: ['active', 'claimed'] },
    }).populate('reportedBy', 'name email');

    const targetTitleWords = extractKeywords(targetItem.title);
    const targetDescWords = extractKeywords(targetItem.description);
    const targetLocWords = extractKeywords(targetItem.location);

    const scoredResults = [];

    for (const candidate of candidates) {
      let score = 0;
      const reasons = [];

      // 1. Category match (Weight: 35%)
      if (candidate.category === targetItem.category) {
        score += 35;
        reasons.push(`Same category: ${candidate.category}`);
      }

      // 2. Title keywords overlap (Weight: 30%)
      const candTitleWords = extractKeywords(candidate.title);
      const titleOverlap = keywordOverlap(targetTitleWords, candTitleWords);
      if (titleOverlap.matches.length > 0) {
        const titleScore = Math.min(30, Math.round(titleOverlap.score * 40) + titleOverlap.matches.length * 8);
        score += titleScore;
        reasons.push(`Matching title words: "${titleOverlap.matches.slice(0, 3).join(', ')}"`);
      }

      // 3. Description keywords overlap (Weight: 15%)
      const candDescWords = extractKeywords(candidate.description);
      const descOverlap = keywordOverlap(targetDescWords, candDescWords);
      if (descOverlap.matches.length > 0) {
        const descScore = Math.min(15, descOverlap.matches.length * 5);
        score += descScore;
        reasons.push(`Similar description details: "${descOverlap.matches.slice(0, 3).join(', ')}"`);
      }

      // 4. Location similarity (Weight: 10%)
      const candLocWords = extractKeywords(candidate.location);
      const locOverlap = keywordOverlap(targetLocWords, candLocWords);
      if (locOverlap.matches.length > 0) {
        score += 10;
        reasons.push(`Nearby location: "${locOverlap.matches.join(', ')}"`);
      }

      // 5. Date proximity (Weight: 10%)
      if (targetItem.itemDate && candidate.itemDate) {
        const diffMs = Math.abs(new Date(targetItem.itemDate) - new Date(candidate.itemDate));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) {
          score += 10;
          reasons.push('Dates within 3 days of each other');
        } else if (diffDays <= 7) {
          score += 7;
          reasons.push('Dates within 1 week of each other');
        } else if (diffDays <= 14) {
          score += 4;
          reasons.push('Dates within 2 weeks of each other');
        }
      }

      // Threshold: at least 35% similarity required
      if (score >= 35) {
        scoredResults.push({
          item: candidate,
          score: Math.min(score, 100),
          reasons,
        });
      }
    }

    // Sort descending by score
    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, limit);
  },

  /**
   * Run matching check for a newly submitted item and notify the user if strong matches found
   */
  async notifyIfMatchesFound(newItem) {
    try {
      const matches = await this.findMatches(newItem, 3);
      if (matches.length > 0 && newItem.reportedBy) {
        const topMatch = matches[0];
        const reporterId = newItem.reportedBy._id || newItem.reportedBy;
        await notificationService.create({
          recipient: reporterId,
          message: `We found a potential matching ${topMatch.item.type} item: "${topMatch.item.title}" (${topMatch.score}% match). Check your report details!`,
          type: 'match_found',
          relatedItem: newItem._id,
        });
      }
    } catch (err) {
      console.error('[MatchingService] Error during auto-match notification:', err.message);
    }
  },
};

module.exports = matchingService;

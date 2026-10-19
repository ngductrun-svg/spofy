// Presentation-only edits: the original database title and article body stay
// unchanged. There is no automatic production data migration in this module.
export function articleDisplay(row) {
  const originalTitle = row.originalTitle || row.title || '';
  const hotDrink = row.slug === 'calling-for-a-hot-drink';
  const displayTitle = hotDrink ? 'Chocolate nóng trong những ngày lạnh' : originalTitle;
  const editorialSummary = hotDrink
    ? 'Một gợi ý đồ uống cho những ngày lạnh từ SPOFY, cùng những cách tận hưởng mùa đông bên người thân.'
    : row.summary || '';
  return { originalTitle, displayTitle, editorialSummary, sourceUrl: row.sourceUrl || null,
    ...(hotDrink ? { editorialReview: { status: 'needs-source', issues: ['missing-science-explanation', 'category-needs-source', 'missing-original-source'] } } : {}) };
}

export function displayArticleBlocks(blocks) {
  // Exact spelling correction requested by the editor, with no scientific or
  // factual expansion. Stored source text remains untouched for comparison.
  return blocks.map(block => block.type === 'paragraph' ? {
    ...block, text: block.text.replace(/cùng nhậu dạo bước/g, 'cùng nhau dạo bước').replace(/\\n/g, '\n'),
  } : block);
}

export function publicArticlePresentation(article) {
  if (!article) return article;
  const result = { ...article, ...articleDisplay(article) };
  if (article.slug === 'calling-for-a-hot-drink' && Array.isArray(article.blocks)) result.blocks = displayArticleBlocks(article.blocks);
  return result;
}

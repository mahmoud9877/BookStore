export const buildPageFacet = (page, limit, { itemStages = [], extraFacets = {} } = {}) => ({
  $facet: {
    items: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...itemStages],
    total: [{ $count: "n" }],
    ...extraFacets,
  },
});

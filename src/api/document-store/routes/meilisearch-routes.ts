// src/api/document-store/routes/meilisearch-routes.ts
// Additional routes for MeiliSearch management

module.exports = {
  routes: [
    // MeiliSearch management routes
    {
      method: 'POST',
      path: '/document-stores/meilisearch/refresh',
      handler: 'meilisearch-controller.refreshIndex',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/document-stores/meilisearch/stats',
      handler: 'meilisearch-controller.getIndexStats',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/document-stores/meilisearch/clear',
      handler: 'meilisearch-controller.clearIndex',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/document-stores/meilisearch/rebuild',
      handler: 'meilisearch-controller.rebuildIndex',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/document-stores/meilisearch/configure',
      handler: 'meilisearch-controller.configureIndex',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/document-stores/search/advanced',
      handler: 'meilisearch-controller.advancedSearch',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
// src/api/document-store/routes/document-store.ts
// CLEAN VERSION - Remove all problematic publish endpoints

module.exports = {
  routes: [
    // Standard CRUD routes only
    {
      method: 'GET',
      path: '/document-stores',
      handler: 'document-store.find',
    },
    {
      method: 'GET',
      path: '/document-stores/:id',
      handler: 'document-store.findOne',
    },
    {
      method: 'POST',
      path: '/document-stores',
      handler: 'document-store.create',
    },
    {
      method: 'PUT',
      path: '/document-stores/:id',
      handler: 'document-store.update',
    },
    {
      method: 'DELETE',
      path: '/document-stores/:id',
      handler: 'document-store.delete',
    },

    // Only keep working custom routes
    {
      method: 'POST',
      path: '/document-stores/:id/auto-populate',
      handler: 'document-store.autoPopulate',
    },
    {
      method: 'GET',
      path: '/document-stores/system/health',
      handler: 'document-store.health',
      config: {
        auth: false,
      },
    },
  ],
};

// IMPORTANT: Make sure you DON'T have any other route files that might contain the publish endpoints
// Check these files and remove any publish routes if they exist:
// - src/api/document-store/routes/meilisearch-routes.ts (if it has publish routes)
// - Any other route files in the document-store folder
// src/api/document-store/controllers/meilisearch-controller.ts
// Controller for MeiliSearch management endpoints

module.exports = ({ strapi }: { strapi: any }) => ({
  
  // Refresh entire index
  async refreshIndex(ctx: any) {
    try {
      const MeiliSearchManager = require('../services/meilisearch-manager').default;
      const manager = new MeiliSearchManager({
        host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILISEARCH_API_KEY,
        indexName: 'document_stores'
      });

      const result = await manager.refreshIndex();
      
      return ctx.send({
        success: result.success,
        message: result.message,
        data: result.stats
      });
      
    } catch (error) {
      strapi.log.error('Index refresh failed:', error);
      return ctx.internalServerError('Index refresh failed');
    }
  },

  // Get index statistics
  async getIndexStats(ctx: any) {
    try {
      const MeiliSearchManager = require('../services/meilisearch-manager').default;
      const manager = new MeiliSearchManager({
        host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILISEARCH_API_KEY,
        indexName: 'document_stores'
      });

      const stats = await manager.getIndexStats();
      
      return ctx.send({
        data: stats
      });
      
    } catch (error) {
      strapi.log.error('Failed to get index stats:', error);
      return ctx.internalServerError('Failed to get index stats');
    }
  },

  // Clear index
  async clearIndex(ctx: any) {
    try {
      const MeiliSearchManager = require('../services/meilisearch-manager').default;
      const manager = new MeiliSearchManager({
        host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILISEARCH_API_KEY,
        indexName: 'document_stores'
      });

      await manager.clearIndex();
      
      return ctx.send({
        success: true,
        message: 'Index cleared successfully'
      });
      
    } catch (error) {
      strapi.log.error('Failed to clear index:', error);
      return ctx.internalServerError('Failed to clear index');
    }
  },

  // Rebuild index
  async rebuildIndex(ctx: any) {
    try {
      const MeiliSearchManager = require('../services/meilisearch-manager').default;
      const manager = new MeiliSearchManager({
        host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILISEARCH_API_KEY,
        indexName: 'document_stores'
      });

      const result = await manager.rebuildIndex();
      
      return ctx.send({
        success: true,
        message: `Index rebuilt successfully. Indexed ${result.indexed} documents.`,
        data: result
      });
      
    } catch (error) {
      strapi.log.error('Failed to rebuild index:', error);
      return ctx.internalServerError('Failed to rebuild index');
    }
  },

  // Configure index settings
  async configureIndex(ctx: any) {
    try {
      const MeiliSearchManager = require('../services/meilisearch-manager').default;
      const manager = new MeiliSearchManager({
        host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILISEARCH_API_KEY,
        indexName: 'document_stores'
      });

      await manager.configureIndex();
      
      return ctx.send({
        success: true,
        message: 'Index configuration updated successfully'
      });
      
    } catch (error) {
      strapi.log.error('Failed to configure index:', error);
      return ctx.internalServerError('Failed to configure index');
    }
  },

  // Enhanced search with all features
  async advancedSearch(ctx: any) {
    try {
      const { 
        query = '', 
        limit = 20, 
        offset = 0,
        filters = {},
        sort = [],
        facets = [],
        ...options 
      } = ctx.query;

      const MeiliSearchManager = require('../services/meilisearch-manager').default;
      const manager = new MeiliSearchManager({
        host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILISEARCH_API_KEY,
        indexName: 'document_stores'
      });

      // Build search options
      const searchOptions: any = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        filter: [],
        sort: sort.length > 0 ? sort : ['updatedAt:desc'],
        attributesToHighlight: ['SF_Number', 'Client_Name', 'Description', 'Industry', 'Service'],
        attributesToCrop: ['Description', 'description_text'],
        cropLength: 200,
        facets: facets.length > 0 ? facets : ['filters.*'],
        ...options
      };

      // Build filters
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          searchOptions.filter.push(`filters.${key} = "${filters[key]}"`);
        }
      });

      const results = await manager.search(query, searchOptions);
      
      return ctx.send({
        data: results.hits,
        meta: {
          pagination: {
            page: Math.floor(searchOptions.offset / searchOptions.limit) + 1,
            pageSize: searchOptions.limit,
            total: results.estimatedTotalHits
          },
          search: {
            query: results.query,
            processingTime: results.processingTimeMs,
            facetDistribution: results.facetDistribution || {}
          }
        }
      });
      
    } catch (error) {
      strapi.log.error('Advanced search failed:', error);
      return ctx.internalServerError('Advanced search failed');
    }
  }
});
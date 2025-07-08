// src/api/document-store/controllers/meilisearch-controller.ts
// UPDATED: Controller with complete index configuration method

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

  // NEW: Complete index configuration with all fields
  async configureIndexSettings(ctx: any) {
    try {
      console.log('🔧 Configuring MeiliSearch index settings for all fields...');
      
      const { MeiliSearch } = require('meilisearch');
      const client = new MeiliSearch({
        host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILISEARCH_API_KEY,
      });

      const index = client.index('document_stores');
      
      // 1. Configure searchable attributes (COMPLETE LIST)
      console.log('📝 Setting searchable attributes...');
      await index.updateSearchableAttributes([
        'SF_Number',
        'Client_Name', 
        'Description',
        'Client_Contact_Buying_Center',
        'Client_Journey',              // ✅ Missing field
        'Document_Confidentiality',
        'Document_Value_Range',        // ✅ Missing field
        'Document_Outcome',            // ✅ Missing field
        'Last_Stage_Change_Date',      // ✅ Missing field
        'searchableText',
        'Client_Type',
        'Document_Type',
        'Document_Sub_Type',
        'Unique_Id',
        'Client_Contact',
        'Industry',
        'Sub_Industry',                // ✅ Missing field
        'Service',
        'Sub_Service',                 // ✅ Missing field
        'State',                       // ✅ Missing field
        'City',                        // ✅ Missing field
        'Commercial_Program',          // ✅ Missing field
        'Author',
        'SMEs',
        'Competitors',                 // ✅ Missing field
        'attachments_text',
        'Business_Unit',
        'Region',
        'Country'
      ]);

      // 2. Configure filterable attributes (COMPLETE LIST)
      console.log('🔍 Setting filterable attributes...');
      await index.updateFilterableAttributes([
        // Direct field filters
        'SF_Number',
        'Client_Type',
        'Document_Type',
        'Document_Sub_Type',
        'Document_Confidentiality',
        'Document_Outcome',            // ✅ Missing field
        'Industry',
        'Sub_Industry',                // ✅ Missing field
        'Service',
        'Sub_Service',                 // ✅ Missing field
        'Region',
        'Business_Unit',
        'Country', 
        'State',                       // ✅ Missing field
        'City',                        // ✅ Missing field
        'Commercial_Program',          // ✅ Missing field
        'Client_Journey',              // ✅ Missing field
        'Document_Value_Range',        // ✅ Missing field
        'has_attachments',
        'attachments_count',
        'publishedAt',
        'createdAt',
        'updatedAt',
        'Last_Stage_Change_Date',      // ✅ Missing field
        
        // Nested filters
        'filters.Client_Type',
        'filters.Document_Type',
        'filters.Document_Sub_Type', 
        'filters.Document_Confidentiality',
        'filters.Document_Outcome',
        'filters.Industry',
        'filters.Sub_Industry',
        'filters.Service',
        'filters.Sub_Service',
        'filters.Business_Unit',
        'filters.Region',
        'filters.Country',
        'filters.State',
        'filters.City',
        'filters.Commercial_Program',
        'filters.has_attachments'
      ]);

      // 3. Configure sortable attributes (COMPLETE LIST)
      console.log('📊 Setting sortable attributes...');
      await index.updateSortableAttributes([
        'createdAt',
        'updatedAt', 
        'publishedAt',
        'Last_Stage_Change_Date',      // ✅ Missing field
        'Unique_Id',
        'Client_Name',
        'Document_Value_Range',        // ✅ Missing field
        'attachments_count',
        'SF_Number'
      ]);

      // 4. CRITICAL: Configure displayed attributes (SHOW ALL FIELDS)
      console.log('👁️ Setting displayed attributes to show ALL fields...');
      await index.updateDisplayedAttributes(['*']);

      // 5. Wait for configuration to complete
      console.log('⏳ Waiting for configuration to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 6. Get current settings to verify
      const settings = await index.getSettings();
      console.log('⚙️ Current settings applied:');
      console.log('   - Searchable attributes count:', settings.searchableAttributes?.length);
      console.log('   - Filterable attributes count:', settings.filterableAttributes?.length);
      console.log('   - Sortable attributes count:', settings.sortableAttributes?.length);
      console.log('   - Displayed attributes:', settings.displayedAttributes);

      // 7. Get index stats
      const stats = await index.getStats();
      console.log('📊 Index stats after configuration:');
      console.log('   - Documents count:', stats.numberOfDocuments);
      console.log('   - Field distribution:', Object.keys(stats.fieldDistribution || {}));

      return ctx.send({
        success: true,
        message: 'MeiliSearch index configured successfully with all fields',
        data: {
          searchableAttributesCount: settings.searchableAttributes?.length,
          filterableAttributesCount: settings.filterableAttributes?.length,
          sortableAttributesCount: settings.sortableAttributes?.length,
          documentsCount: stats.numberOfDocuments,
          configuredFields: Object.keys(stats.fieldDistribution || {}),
          displayedAttributes: settings.displayedAttributes
        }
      });
      
    } catch (error) {
      console.error('❌ Configuration failed:', error);
      return ctx.internalServerError('Failed to configure MeiliSearch index: ' + error.message);
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
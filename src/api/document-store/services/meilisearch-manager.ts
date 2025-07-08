// src/api/document-store/services/meilisearch-manager.ts
// COMPLETE FIXED VERSION - Include ALL fields, attachments, and proper date handling

import { MeiliSearch } from 'meilisearch';

interface MeiliSearchConfig {
  host: string;
  apiKey: string;
  indexName: string;
}

class MeiliSearchManager {
  private client: MeiliSearch;
  private indexName: string;

  constructor(config: MeiliSearchConfig) {
    this.client = new MeiliSearch({
      host: config.host,
      apiKey: config.apiKey,
    });
    this.indexName = config.indexName;
  }

  // Get index instance
  private getIndex() {
    return this.client.index(this.indexName);
  }

  // 1. Refresh entire index (clear and rebuild)
  async refreshIndex(): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      console.log('🔄 Starting index refresh...');
      
      // Step 1: Clear existing index
      await this.clearIndex();
      
      // Step 2: Rebuild index with all published documents
      const result = await this.rebuildIndex();
      
      return {
        success: true,
        message: `Index refreshed successfully. Indexed ${result.indexed} documents.`,
        stats: result
      };
    } catch (error) {
      console.error('❌ Index refresh failed:', error);
      return {
        success: false,
        message: `Index refresh failed: ${error.message}`
      };
    }
  }

  // 2. Clear all documents from index
  async clearIndex(): Promise<void> {
    try {
      const index = this.getIndex();
      await index.deleteAllDocuments();
      console.log('🗑️ Cleared all documents from index');
      
      // Wait for deletion to complete
      await this.waitForTask();
    } catch (error) {
      console.error('❌ Failed to clear index:', error);
      throw error;
    }
  }

  // 3. FIXED: Rebuild index with all published documents (using correct Strapi API)
  async rebuildIndex(): Promise<{ indexed: number; skipped: number }> {
    try {
      console.log('🔨 Rebuilding index from Strapi data...');
      
      // FIXED: Use direct database query to find truly published documents
      console.log('🔍 Querying database for published documents...');
      
      const documents = await strapi.db.query('api::document-store.document-store').findMany({
        where: {
          publishedAt: {
            $notNull: true
          }
        },
        populate: {
          Attachments: true
        },
        limit: -1
      });
      
      console.log(`📊 Database query returned ${documents?.length || 0} published documents`);

      if (!documents || documents.length === 0) {
        console.log('📭 No published documents found');
        
        // Debug: Check total documents
        const allDocs = await strapi.db.query('api::document-store.document-store').findMany({
          select: ['id', 'publishedAt'],
          limit: 10
        });
        
        console.log('🔍 DEBUG: Sample of all documents in database:');
        allDocs?.forEach((doc, index) => {
          console.log(`   ${index + 1}. ID: ${doc.id}, publishedAt: ${doc.publishedAt} (${typeof doc.publishedAt})`);
        });
        
        return { indexed: 0, skipped: 0 };
      }

      console.log(`📄 Found ${documents.length} published documents to index`);

      // DEBUG: Show sample document
      if (documents.length > 0) {
        const sample = documents[0];
        console.log('🔍 DEBUG: Sample published document:');
        console.log(`   - ID: ${sample.id}`);
        console.log(`   - SF_Number: ${sample.SF_Number}`);
        console.log(`   - publishedAt: ${sample.publishedAt} (${typeof sample.publishedAt})`);
        console.log(`   - createdAt: ${sample.createdAt}`);
        console.log(`   - updatedAt: ${sample.updatedAt}`);
        console.log(`   - Has Attachments: ${!!(sample.Attachments && sample.Attachments.length > 0)}`);
        console.log(`   - All Fields: ${Object.keys(sample).join(', ')}`);
      }

      // Prepare documents for MeiliSearch
      const searchableDocuments = documents.map(doc => {
        const transformed = this.transformDocumentForSearch(doc);
        return transformed;
      });

      console.log(`🔄 Transformed ${searchableDocuments.length} documents for indexing`);

      // Index in batches of 100
      const batchSize = 100;
      let indexed = 0;
      let skipped = 0;

      for (let i = 0; i < searchableDocuments.length; i += batchSize) {
        const batch = searchableDocuments.slice(i, i + batchSize);
        
        try {
          const index = this.getIndex();
          await index.addDocuments(batch);
          indexed += batch.length;
          console.log(`📦 Indexed batch ${Math.floor(i / batchSize) + 1}: ${batch.length} documents`);
        } catch (error) {
          console.error(`❌ Failed to index batch ${Math.floor(i / batchSize) + 1}:`, error);
          skipped += batch.length;
        }
      }

      console.log(`✅ Rebuild complete: ${indexed} indexed, ${skipped} skipped`);
      return { indexed, skipped };

    } catch (error) {
      console.error('❌ Failed to rebuild index:', error);
      throw error;
    }
  }

  // 4. FIXED: Transform Strapi document to MeiliSearch format with proper date handling
  private transformDocumentForSearch(document: any): any {
    const descriptionText = this.extractTextFromBlocks(document.Description);
    const attachmentsText = this.formatAttachments(document.Attachments);
    
    // FIXED: Proper date handling for publishedAt
    const getValidDate = (dateValue: any): string | null => {
      if (!dateValue) return null;
      if (typeof dateValue === 'string' && dateValue.trim() === '') return null;
      
      try {
        const date = new Date(dateValue);
        return !isNaN(date.getTime()) ? date.toISOString() : null;
      } catch (error) {
        console.warn('Invalid date value:', dateValue);
        return null;
      }
    };
    
    const transformedDoc = {
      // Primary identifiers
      id: document.id,
      documentId: document.documentId,
      strapiId: document.id,
      
      // ALL Core document fields (FIXED: Include all missing fields)
      SF_Number: document.SF_Number || '',
      Unique_Id: document.Unique_Id || '',
      Client_Name: document.Client_Name || '',
      Client_Type: document.Client_Type || '',
      Client_Contact: document.Client_Contact || '',
      Client_Contact_Buying_Center: document.Client_Contact_Buying_Center || '',
      Client_Journey: document.Client_Journey || '', // FIXED: Was missing
      
      // ALL Document metadata (FIXED: Include all missing fields)
      Document_Confidentiality: document.Document_Confidentiality || '',
      Document_Type: document.Document_Type || '',
      Document_Sub_Type: document.Document_Sub_Type || '',
      Document_Value_Range: document.Document_Value_Range || '', // FIXED: Was missing
      Document_Outcome: document.Document_Outcome || '', // FIXED: Was missing
      Last_Stage_Change_Date: document.Last_Stage_Change_Date || '', // FIXED: Was missing
      
      // ALL Business classification (FIXED: Include all missing fields)
      Industry: document.Industry || '',
      Sub_Industry: document.Sub_Industry || '', // FIXED: Was missing
      Service: document.Service || '',
      Sub_Service: document.Sub_Service || '', // FIXED: Was missing
      Business_Unit: document.Business_Unit || '',
      Region: document.Region || '',
      Country: document.Country || '',
      State: document.State || '', // FIXED: Was missing
      City: document.City || '', // FIXED: Was missing
      
      // ALL People and programs (FIXED: Include all missing fields)
      Author: document.Author || '',
      SMEs: document.SMEs || '',
      Commercial_Program: document.Commercial_Program || '', // FIXED: Was missing
      Competitors: document.Competitors || '', // FIXED: Was missing
      
      // FIXED: System fields with proper date handling
      publishedAt: getValidDate(document.publishedAt),
      createdAt: getValidDate(document.createdAt),
      updatedAt: getValidDate(document.updatedAt),
      locale: document.locale,
      
      // Text content for search
      Description: descriptionText,
      description_text: descriptionText,
      attachments_text: attachmentsText,
      
      // FIXED: Complete attachments array with all details
      Attachments: this.transformAttachments(document.Attachments),
      attachments_count: document.Attachments ? document.Attachments.length : 0,
      has_attachments: !!(document.Attachments && document.Attachments.length > 0),
      
      // FIXED: Comprehensive searchable text with all missing fields
      searchableText: [
        document.SF_Number,
        document.Unique_Id,
        document.Client_Name,
        document.Client_Contact,
        document.Client_Contact_Buying_Center,
        document.Client_Journey, // FIXED: Added
        descriptionText,
        document.Document_Confidentiality,
        document.Document_Value_Range, // FIXED: Added
        document.Document_Outcome, // FIXED: Added
        document.Industry,
        document.Sub_Industry, // FIXED: Added
        document.Service,
        document.Sub_Service, // FIXED: Added
        document.State, // FIXED: Added
        document.City, // FIXED: Added
        document.Commercial_Program, // FIXED: Added
        document.Author,
        document.SMEs,
        document.Competitors, // FIXED: Added
        attachmentsText
      ].filter(Boolean).join(' ').toLowerCase(),
      
      // FIXED: Structured filters with all missing fields
      filters: {
        Client_Type: document.Client_Type || '',
        Document_Type: document.Document_Type || '',
        Document_Sub_Type: document.Document_Sub_Type || '',
        Document_Confidentiality: document.Document_Confidentiality || '',
        Document_Outcome: document.Document_Outcome || '', // FIXED: Added
        Industry: document.Industry || '',
        Sub_Industry: document.Sub_Industry || '', // FIXED: Added
        Service: document.Service || '',
        Sub_Service: document.Sub_Service || '', // FIXED: Added
        Business_Unit: document.Business_Unit || '',
        Region: document.Region || '',
        Country: document.Country || '',
        State: document.State || '', // FIXED: Added
        City: document.City || '', // FIXED: Added
        Commercial_Program: document.Commercial_Program || '', // FIXED: Added
        has_attachments: !!(document.Attachments && document.Attachments.length > 0)
      }
    };
    
    // FIXED: Debug logging for date transformation
    console.log(`🔍 Date transformation for document ${document.id}:`);
    console.log(`   - Input publishedAt: ${document.publishedAt} (${typeof document.publishedAt})`);
    console.log(`   - Output publishedAt: ${transformedDoc.publishedAt} (${typeof transformedDoc.publishedAt})`);
    
    return transformedDoc;
  }

  // 5. Get index statistics
  async getIndexStats(): Promise<any> {
    try {
      const index = this.getIndex();
      const stats = await index.getStats();
      const settings = await index.getSettings();
      
      return {
        numberOfDocuments: stats.numberOfDocuments,
        isIndexing: stats.isIndexing,
        fieldDistribution: stats.fieldDistribution,
        settings: {
          searchableAttributes: settings.searchableAttributes,
          filterableAttributes: settings.filterableAttributes,
          sortableAttributes: settings.sortableAttributes
        }
      };
    } catch (error) {
      console.error('❌ Failed to get index stats:', error);
      throw error;
    }
  }

  // 6. FIXED: Index single document with attachment fetching and detailed debugging
  async indexDocument(document: any): Promise<void> {
    try {
      console.log(`🔄 Indexing document ${document.id} to MeiliSearch...`);
      console.log(`📋 Original document publishedAt: ${document.publishedAt} (${typeof document.publishedAt})`);
      
      // FIXED: If document doesn't have attachments populated, fetch them
      let documentWithAttachments = document;
      if (!document.Attachments) {
        console.log(`📎 Fetching attachments for document ${document.id}...`);
        try {
          documentWithAttachments = await strapi.entityService.findOne('api::document-store.document-store', document.id, {
            populate: {
              Attachments: {
                fields: ['id', 'name', 'alternativeText', 'caption', 'url', 'ext', 'mime', 'size']
              }
            }
          });
          
          // Merge the original document data with fetched attachments
          documentWithAttachments = {
            ...document,
            Attachments: documentWithAttachments?.Attachments || null
          };
          
          console.log(`📎 Fetched ${documentWithAttachments.Attachments?.length || 0} attachments`);
        } catch (fetchError) {
          console.warn('⚠️ Failed to fetch attachments, proceeding without them:', fetchError);
          documentWithAttachments = { ...document, Attachments: null };
        }
      }
      
      const index = this.getIndex();
      const searchableDocument = this.transformDocumentForSearch(documentWithAttachments);
      
      console.log(`📋 Transformed document publishedAt: ${searchableDocument.publishedAt} (${typeof searchableDocument.publishedAt})`);
      console.log(`📋 Document data being sent to MeiliSearch:`, {
        id: searchableDocument.id,
        SF_Number: searchableDocument.SF_Number,
        publishedAt: searchableDocument.publishedAt,
        createdAt: searchableDocument.createdAt,
        updatedAt: searchableDocument.updatedAt,
        attachments_count: searchableDocument.attachments_count
      });
      
      await index.addDocuments([searchableDocument]);
      console.log(`✅ Successfully indexed document ${document.id} with publishedAt: ${searchableDocument.publishedAt}`);
    } catch (error) {
      console.error('❌ Failed to index single document:', error);
      throw error;
    }
  }

  // 7. Remove document from index
  async removeDocument(documentId: string | number): Promise<void> {
    try {
      const index = this.getIndex();
      await index.deleteDocument(documentId);
    } catch (error) {
      console.error('❌ Failed to remove document:', error);
      throw error;
    }
  }

  // 8. Search documents
  async search(query: string, options: any = {}): Promise<any> {
    try {
      const index = this.getIndex();
      return await index.search(query, options);
    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  // 9. ENHANCED: Configure index settings with ALL missing fields
  async configureIndex(): Promise<void> {
    try {
      const index = this.getIndex();
      
      console.log('🔧 Configuring MeiliSearch index with ALL fields...');
      
      // FIXED: Configure searchable attributes (in order of importance) with ALL missing fields
      await index.updateSearchableAttributes([
        'SF_Number',
        'Client_Name',
        'Description',
        'Client_Contact_Buying_Center',
        'Client_Journey',              // ✅ FIXED: Added missing field
        'Document_Confidentiality',
        'Document_Value_Range',        // ✅ FIXED: Added missing field
        'Document_Outcome',            // ✅ FIXED: Added missing field
        'Last_Stage_Change_Date',      // ✅ FIXED: Added missing field
        'searchableText',
        'Client_Type',
        'Document_Type',
        'Document_Sub_Type',
        'Unique_Id',
        'Client_Contact',
        'Industry',
        'Sub_Industry',                // ✅ FIXED: Added missing field
        'Service',
        'Sub_Service',                 // ✅ FIXED: Added missing field
        'State',                       // ✅ FIXED: Added missing field
        'City',                        // ✅ FIXED: Added missing field
        'Commercial_Program',          // ✅ FIXED: Added missing field
        'Author',
        'SMEs',
        'Competitors',                 // ✅ FIXED: Added missing field
        'attachments_text',
        'Business_Unit',
        'Region',
        'Country',
        'Attachments.name',            // ✅ FIXED: Added for attachment search
        'Attachments.alternativeText'  // ✅ FIXED: Added for attachment search
      ]);
      
      // FIXED: Configure filterable attributes with ALL missing fields
      await index.updateFilterableAttributes([
        // Direct field filters (ALL fields)
        'SF_Number',
        'Client_Type',
        'Document_Type',
        'Document_Sub_Type',
        'Document_Confidentiality',
        'Document_Outcome',            // ✅ FIXED: Added missing field
        'Industry',
        'Sub_Industry',                // ✅ FIXED: Added missing field
        'Service',
        'Sub_Service',                 // ✅ FIXED: Added missing field
        'Region',
        'Business_Unit',
        'Country',
        'State',                       // ✅ FIXED: Added missing field
        'City',                        // ✅ FIXED: Added missing field
        'Commercial_Program',          // ✅ FIXED: Added missing field
        'Client_Journey',              // ✅ FIXED: Added missing field
        'Document_Value_Range',        // ✅ FIXED: Added missing field
        'has_attachments',
        'attachments_count',
        'publishedAt',
        'createdAt',
        'updatedAt',
        'Last_Stage_Change_Date',      // ✅ FIXED: Added missing field
        
        // Nested filters (ALL fields)
        'filters.Client_Type',
        'filters.Document_Type',
        'filters.Document_Sub_Type',
        'filters.Document_Confidentiality',
        'filters.Document_Outcome',    // ✅ FIXED: Added missing field
        'filters.Industry',
        'filters.Sub_Industry',        // ✅ FIXED: Added missing field
        'filters.Service',
        'filters.Sub_Service',         // ✅ FIXED: Added missing field
        'filters.Business_Unit',
        'filters.Region',
        'filters.Country',
        'filters.State',               // ✅ FIXED: Added missing field
        'filters.City',                // ✅ FIXED: Added missing field
        'filters.Commercial_Program',  // ✅ FIXED: Added missing field
        'filters.has_attachments'
      ]);
      
      // FIXED: Configure sortable attributes with missing fields
      await index.updateSortableAttributes([
        'createdAt',
        'updatedAt',
        'publishedAt',
        'Last_Stage_Change_Date',      // ✅ FIXED: Added missing field
        'Unique_Id',
        'Client_Name',
        'Document_Value_Range',        // ✅ FIXED: Added missing field
        'attachments_count',
        'SF_Number'
      ]);

      // ✅ CRITICAL: Configure displayed attributes to show ALL fields
      await index.updateDisplayedAttributes(['*']);
      
      // Configure ranking rules
      await index.updateRankingRules([
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness'
      ]);
      
      // FIXED: Configure synonyms with all new terms
      await index.updateSynonyms({
        'proposal': ['rfp', 'request for proposal', 'tender'],
        'client': ['customer', 'account', 'company'],
        'document': ['doc', 'file', 'record'],
        'sme': ['subject matter expert', 'expert', 'specialist'],
        'won': ['successful', 'awarded', 'victory'],
        'lost': ['unsuccessful', 'rejected', 'defeat'],
        'attachment': ['file', 'document', 'upload', 'pdf'],
        'competitor': ['rival', 'competition', 'competing company'],
        'journey': ['stage', 'phase', 'step'],                    // ✅ FIXED: Added
        'outcome': ['result', 'status', 'decision'],              // ✅ FIXED: Added
        'program': ['initiative', 'project', 'campaign']          // ✅ FIXED: Added
      });
      
      console.log('✅ Index configuration updated successfully with ALL missing fields');
    } catch (error) {
      console.error('❌ Failed to configure index:', error);
      throw error;
    }
  }

  // 10. Wait for MeiliSearch tasks to complete
  private async waitForTask(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const index = this.getIndex();
        const stats = await index.getStats();
        if (!stats.isIndexing) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error waiting for task:', error);
        break;
      }
    }
  }

  // FIXED: Helper method to transform attachments properly
  private transformAttachments(attachments: any): any[] {
    if (!attachments || !Array.isArray(attachments)) return [];
    
    return attachments.map((attachment: any) => ({
      id: attachment.id,
      name: attachment.name || '',
      alternativeText: attachment.alternativeText || '',
      caption: attachment.caption || '',
      url: attachment.url || '',
      ext: attachment.ext || '',
      mime: attachment.mime || '',
      size: attachment.size || 0,
      // Create searchable text for this attachment
      searchableText: [
        attachment.name,
        attachment.alternativeText,
        attachment.caption
      ].filter(Boolean).join(' ')
    }));
  }

  // Helper method to extract text from blocks
  private extractTextFromBlocks(blocks: any): string {
    if (!blocks || !Array.isArray(blocks)) return '';
    
    return blocks
      .map((block: any) => {
        if (block.children && Array.isArray(block.children)) {
          return block.children
            .filter((child: any) => child.type === 'text')
            .map((child: any) => child.text)
            .join(' ');
        }
        return '';
      })
      .join(' ')
      .trim();
  }

  // FIXED: Helper method to format attachments for search
  private formatAttachments(attachments: any): string {
    if (!attachments || !Array.isArray(attachments)) return '';
    
    return attachments
      .map((attachment: any) => {
        return [
          attachment.name,
          attachment.alternativeText,
          attachment.caption,
          attachment.ext, // FIXED: Include file extension
          attachment.mime // FIXED: Include mime type
        ].filter(Boolean).join(' ');
      })
      .join(' ');
  }
}

// Export the manager class
export default MeiliSearchManager;
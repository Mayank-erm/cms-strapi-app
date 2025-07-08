// src/api/document-store/services/meilisearch-manager.ts
// Separate file for MeiliSearch management and utilities

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

  // 3. Rebuild index with all published documents
  async rebuildIndex(): Promise<{ indexed: number; skipped: number }> {
    try {
      console.log('🔨 Rebuilding index from Strapi data...');
      
      // Get all published documents from Strapi
      const documents = await strapi.entityService.findMany('api::document-store.document-store', {
        publicationState: 'live', // Only published documents
        populate: {
          Attachments: {
            fields: ['name', 'alternativeText', 'caption', 'url']
          }
        },
        limit: -1 // Get all documents
      });

      if (!documents || documents.length === 0) {
        console.log('📭 No published documents found to index');
        return { indexed: 0, skipped: 0 };
      }

      console.log(`📄 Found ${documents.length} published documents to index`);

      // Prepare documents for MeiliSearch
      const searchableDocuments = documents.map(doc => this.transformDocumentForSearch(doc));

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

  // 4. Transform Strapi document to MeiliSearch format
  private transformDocumentForSearch(document: any): any {
    const descriptionText = this.extractTextFromBlocks(document.Description);
    const attachmentsText = this.formatAttachments(document.Attachments);
    
    return {
      // Primary identifiers
      id: document.id,
      documentId: document.documentId,
      
      // ALL Core document fields
      SF_Number: document.SF_Number || '',
      Unique_Id: document.Unique_Id || '',
      Client_Name: document.Client_Name || '',
      Client_Type: document.Client_Type || '',
      Client_Contact: document.Client_Contact || '',
      Client_Contact_Buying_Center: document.Client_Contact_Buying_Center || '',
      Client_Journey: document.Client_Journey || '',
      
      // ALL Document metadata
      Document_Confidentiality: document.Document_Confidentiality || '',
      Document_Type: document.Document_Type || '',
      Document_Sub_Type: document.Document_Sub_Type || '',
      Document_Value_Range: document.Document_Value_Range || '',
      Document_Outcome: document.Document_Outcome || '',
      Last_Stage_Change_Date: document.Last_Stage_Change_Date || '',
      
      // ALL Business classification
      Industry: document.Industry || '',
      Sub_Industry: document.Sub_Industry || '',
      Service: document.Service || '',
      Sub_Service: document.Sub_Service || '',
      Business_Unit: document.Business_Unit || '',
      Region: document.Region || '',
      Country: document.Country || '',
      State: document.State || '',
      City: document.City || '',
      
      // ALL People and programs
      Author: document.Author || '',
      SMEs: document.SMEs || '',
      Commercial_Program: document.Commercial_Program || '',
      Competitors: document.Competitors || '',
      
      // System fields
      publishedAt: document.publishedAt,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      locale: document.locale,
      
      // Text content for search
      Description: descriptionText,
      attachments_text: attachmentsText,
      
      // Comprehensive searchable text
      searchableText: [
        document.SF_Number,
        document.Unique_Id,
        document.Client_Name,
        document.Client_Contact,
        document.Client_Contact_Buying_Center,
        descriptionText,
        document.Document_Confidentiality,
        document.Industry,
        document.Service,
        document.Author,
        document.SMEs,
        document.Competitors,
        attachmentsText
      ].filter(Boolean).join(' ').toLowerCase(),
      
      // Structured filters
      filters: {
        Client_Type: document.Client_Type || '',
        Document_Type: document.Document_Type || '',
        Document_Sub_Type: document.Document_Sub_Type || '',
        Document_Confidentiality: document.Document_Confidentiality || '',
        Industry: document.Industry || '',
        Sub_Industry: document.Sub_Industry || '',
        Service: document.Service || '',
        Sub_Service: document.Sub_Service || '',
        Business_Unit: document.Business_Unit || '',
        Region: document.Region || '',
        Country: document.Country || '',
        State: document.State || '',
        City: document.City || '',
        Commercial_Program: document.Commercial_Program || '',
        Document_Outcome: document.Document_Outcome || ''
      }
    };
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

  // 6. Index single document
  async indexDocument(document: any): Promise<void> {
    try {
      const index = this.getIndex();
      const searchableDocument = this.transformDocumentForSearch(document);
      await index.addDocuments([searchableDocument]);
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

  // 9. Configure index settings
  async configureIndex(): Promise<void> {
    try {
      const index = this.getIndex();
      
      // Configure searchable attributes (in order of importance)
      await index.updateSearchableAttributes([
        'SF_Number',
        'Client_Name',
        'Description',
        'Client_Contact_Buying_Center',
        'Document_Confidentiality',
        'searchableText',
        'Client_Type',
        'Document_Type',
        'Document_Sub_Type',
        'Unique_Id',
        'Client_Contact',
        'Industry',
        'Service',
        'Author',
        'SMEs',
        'Competitors',
        'attachments_text'
      ]);
      
      // Configure filterable attributes
      await index.updateFilterableAttributes([
        'filters.Client_Type',
        'filters.Document_Type',
        'filters.Document_Sub_Type',
        'filters.Document_Confidentiality',
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
        'filters.Document_Outcome',
        'Client_Type',
        'Document_Type',
        'Document_Confidentiality',
        'Industry',
        'Region',
        'Business_Unit',
        'publishedAt',
        'createdAt',
        'updatedAt'
      ]);
      
      // Configure sortable attributes
      await index.updateSortableAttributes([
        'createdAt',
        'updatedAt',
        'publishedAt',
        'Unique_Id',
        'Client_Name',
        'Last_Stage_Change_Date'
      ]);
      
      // Configure ranking rules
      await index.updateRankingRules([
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness'
      ]);
      
      // Configure synonyms
      await index.updateSynonyms({
        'proposal': ['rfp', 'request for proposal', 'tender'],
        'client': ['customer', 'account', 'company'],
        'document': ['doc', 'file', 'record'],
        'sme': ['subject matter expert', 'expert', 'specialist'],
        'won': ['successful', 'awarded', 'victory'],
        'lost': ['unsuccessful', 'rejected', 'defeat']
      });
      
      console.log('✅ Index configuration updated successfully');
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

  // Helper methods
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

  private formatAttachments(attachments: any): string {
    if (!attachments || !Array.isArray(attachments)) return '';
    
    return attachments
      .map((attachment: any) => {
        return [
          attachment.name,
          attachment.alternativeText,
          attachment.caption
        ].filter(Boolean).join(' ');
      })
      .join(' ');
  }
}

// Export the manager class
export default MeiliSearchManager;
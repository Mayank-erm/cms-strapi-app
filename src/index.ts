// src/index.ts - REFACTORED: Use MeiliSearchManager instead of duplicating logic
import axios from 'axios';

interface DocumentData {
  SF_Number?: string;
  manualOverride?: boolean;
  publishedAt?: string | null;
  [key: string]: any;
}

module.exports = {
  register({ strapi }: { strapi: any }) {
    // Initialize MeiliSearch manager once
    let meiliSearchManager: any = null;
    
    const getMeiliSearchManager = () => {
      if (!meiliSearchManager) {
        const MeiliSearchManager = require('./api/document-store/services/meilisearch-manager').default;
        meiliSearchManager = new MeiliSearchManager({
          host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
          apiKey: process.env.MEILISEARCH_API_KEY,
          indexName: 'document_stores'
        });
      }
      return meiliSearchManager;
    };

    // CLEAN lifecycle hooks that use MeiliSearchManager
    strapi.db.lifecycles.subscribe({
      models: ['api::document-store.document-store'],
      
      async beforeCreate(event: any) {
        const { data } = event.params;
        console.log('🟡 beforeCreate triggered for SF_Number:', data.SF_Number);
        
        // Only auto-populate if SF_Number is provided and no manual override flag
        if (data.SF_Number && !data.manualOverride) {
          console.log('🔄 Auto-populating from FastAPI...');
          await fetchAndPopulateFromFastAPI(data);
        }
      },
      
      async beforeUpdate(event: any) {
        const { data, where } = event.params;
        console.log('🟡 beforeUpdate triggered for:', where.id);
        
        // CRITICAL FIX: Don't interfere if this is a publish operation
        const isPublishOperation = data.hasOwnProperty('publishedAt');
        if (isPublishOperation) {
          console.log('📤 Publish operation detected - skipping auto-population to avoid interference');
          console.log('📤 publishedAt value being set:', data.publishedAt);
          return; // EXIT EARLY - don't do anything that might interfere
        }
        
        // Only auto-populate if SF_Number is provided and no manual override flag
        if (data.SF_Number && !data.manualOverride) {
          try {
            // Check if SF_Number changed
            const existingRecord = await strapi.entityService.findOne('api::document-store.document-store', where.id);
            
            // Skip if SF_Number hasn't changed
            if (!existingRecord || existingRecord.SF_Number !== data.SF_Number) {
              console.log('🔄 SF_Number changed, auto-populating from FastAPI...');
              await fetchAndPopulateFromFastAPI(data);
            } else {
              console.log('⏭️ SF_Number unchanged, skipping auto-population');
            }
          } catch (error) {
            strapi.log.warn('Error checking existing record:', error);
          }
        }
      },
      
      async afterCreate(event: any) {
        const { result } = event;
        console.log('🟢 Document created:', {
          id: result.id,
          documentId: result.documentId,
          SF_Number: result.SF_Number,
          publishedAt: result.publishedAt
        });
        
        // FIXED: Check if document is actually published using multiple methods
        const isPublished = await checkIfDocumentIsPublished(result.id);
        console.log(`🔍 Document ${result.id} published status: ${isPublished}`);
        
        if (isPublished) {
          console.log('📤 Indexing published document to MeiliSearch...');
          try {
            // FIXED: Use the result document directly instead of fetching again
            console.log(`🔄 Using document ${result.id} directly for indexing`);
            
            const manager = getMeiliSearchManager();
            await manager.indexDocument(result);
            console.log('✅ Successfully indexed to MeiliSearch using manager');
          } catch (error) {
            console.error('❌ MeiliSearch indexing failed:', error);
          }
        } else {
          console.log('📝 Document created as draft, not indexing to MeiliSearch');
        }
      },
      
      async afterUpdate(event: any) {
        const { result } = event;
        console.log('🟢 Document updated:', {
          id: result.id,
          documentId: result.documentId,
          SF_Number: result.SF_Number,
          publishedAt: result.publishedAt
        });
        
        // FIXED: Check if document is actually published using multiple methods
        const isPublished = await checkIfDocumentIsPublished(result.id);
        console.log(`🔍 Document ${result.id} published status: ${isPublished}`);
        
        if (isPublished) {
          console.log('📤 Document is published, indexing to MeiliSearch...');
          try {
            // FIXED: Use the result document directly instead of fetching again
            console.log(`🔄 Using document ${result.id} directly for indexing`);
            
            const manager = getMeiliSearchManager();
            await manager.indexDocument(result);
            console.log('✅ Successfully indexed to MeiliSearch using manager');
          } catch (error) {
            console.error('❌ MeiliSearch indexing failed:', error);
          }
        } else {
          console.log('📝 Document is draft/unpublished, removing from MeiliSearch...');
          try {
            const manager = getMeiliSearchManager();
            await manager.removeDocument(result.documentId || result.id);
            console.log('✅ Successfully removed from MeiliSearch using manager');
          } catch (error) {
            console.error('❌ MeiliSearch removal failed:', error);
          }
        }
      },
      
      async afterDelete(event: any) {
        const { result } = event;
        console.log('🗑️ Document deleted:', result.id);
        try {
          const manager = getMeiliSearchManager();
          await manager.removeDocument(result.documentId || result.id);
          console.log('✅ Successfully removed from MeiliSearch using manager');
        } catch (error) {
          console.error('❌ MeiliSearch removal failed:', error);
        }
      }
    });

    strapi.log.info('Document Service Middleware registered successfully');
  }
};

// Helper function to fetch and populate from FastAPI (unchanged)
async function fetchAndPopulateFromFastAPI(data: DocumentData): Promise<void> {
  try {
    console.log('Making request to:', `${process.env.FASTAPI_BASE_URL}/api/salesforce/document/${data.SF_Number}`);
    
    const response = await axios.get(`${process.env.FASTAPI_BASE_URL}/api/salesforce/document/${data.SF_Number}`, {
      headers: {
        'Authorization': `Bearer ${process.env.FASTAPI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && response.data.success) {
      const apiData = response.data.data;
      
      // Map fields from API to Strapi - only populate empty fields
      mapAPIFieldsToStrapi(data, apiData);
      
      console.log('✅ Auto-populated document from SF_Number:', data.SF_Number);
    } else {
      console.log('❌ FastAPI returned unsuccessful response:', response.data);
    }
  } catch (error) {
    console.error('❌ FastAPI auto-population failed:', error.message);
    // Don't throw error - allow creation/update to continue
  }
}

// Field mapping function (unchanged)
function mapAPIFieldsToStrapi(strapiData: DocumentData, apiData: any): void {
  const schemaEnums: { [key: string]: string[] } = {
    Client_Type: ["Global Key Client", "Regional Key Client", "Regional Market Portfolio", "Client"],
    Document_Confidentiality: ["Not Confidential", "Confidential"],
    Document_Type: ["Proposal", "External case study", "Internal win story", "Experience listing", "Pitch content", "Marketing material", "Thought leadership"],
    Document_Sub_Type: ["Sole-source", "RFP Response", "Competitive", "Change Order", "Standalone", "EOI", "RFI", "RFQ"],
    Document_Outcome: ["Won", "Lost", "Abandoned", "Decision in progress", "Scope changed (Proposal Revised)", "Full Proposal Not Yet Submitted"],
    Industry: ["Industry A", "Industry B", "Industry C"],
    Sub_Industry: ["Sub A", "Sub B", "Sub C"],
    Service: ["Service A", "Service B", "Service C"],
    Sub_Service: ["Sub A", "Sub B", "Sub C"],
    Business_Unit: ["BU A", "BU B", "BU C"],
    Region: ["Region A", "Region B", "Region C"],
    Country: ["India", "USA", "UK"],
    State: ["Delhi", "California", "London"],
    City: ["New Delhi", "San Francisco", "Manchester"],
    Commercial_Program: ["R2L", "High Priority", "N/A"]
  };

  const validateEnum = (field: string, value: any): string | null => {
    if (!value || !schemaEnums[field]) return value;
    return schemaEnums[field].includes(value) ? value : null;
  };

  const populateField = (strapiField: string, apiValue: any, transformer?: (val: any) => any): void => {
    if (!strapiData[strapiField] && apiValue !== undefined && apiValue !== null && apiValue !== '') {
      const transformedValue = transformer ? transformer(apiValue) : apiValue;
      if (transformedValue !== null) {
        strapiData[strapiField] = transformedValue;
      }
    }
  };

  // Apply all field mappings
  populateField('Unique_Id', apiData.Unique_Id);
  populateField('Client_Name', apiData.Client_Name);
  populateField('Client_Contact', apiData.Client_Contact);
  populateField('Client_Contact_Buying_Center', apiData.Client_Contact_Buying_Center);
  populateField('Client_Journey', apiData.Client_Journey);
  populateField('Document_Value_Range', apiData.Document_Value_Range);
  populateField('Competitors', apiData.Competitors);

  // Enumeration fields with validation
  populateField('Client_Type', apiData.Client_Type, (val) => validateEnum('Client_Type', val));
  populateField('Document_Confidentiality', apiData.Document_Confidentiality, (val) => validateEnum('Document_Confidentiality', val));
  populateField('Document_Type', apiData.Document_Type, (val) => validateEnum('Document_Type', val));
  populateField('Document_Sub_Type', apiData.Document_Sub_Type, (val) => validateEnum('Document_Sub_Type', val));
  populateField('Document_Outcome', apiData.Document_Outcome, (val) => validateEnum('Document_Outcome', val));
  populateField('Industry', apiData.Industry, (val) => validateEnum('Industry', val));
  populateField('Sub_Industry', apiData.Sub_Industry, (val) => validateEnum('Sub_Industry', val));
  populateField('Service', apiData.Service, (val) => validateEnum('Service', val));
  populateField('Sub_Service', apiData.Sub_Service, (val) => validateEnum('Sub_Service', val));
  populateField('Business_Unit', apiData.Business_Unit, (val) => validateEnum('Business_Unit', val));
  populateField('Region', apiData.Region, (val) => validateEnum('Region', val));
  populateField('Country', apiData.Country, (val) => validateEnum('Country', val));
  populateField('State', apiData.State, (val) => validateEnum('State', val));
  populateField('City', apiData.City, (val) => validateEnum('City', val));
  populateField('Commercial_Program', apiData.Commercial_Program, (val) => validateEnum('Commercial_Program', val));

  // Description field (string to blocks conversion)
  populateField('Description', apiData.Description, (val) => {
    if (typeof val === 'string') {
      return [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: val }]
        }
      ];
    }
    return val;
  });

  // Date field conversion
  populateField('Last_Stage_Change_Date', apiData.Last_Stage_Change_Date, (val) => {
    if (typeof val === 'string') {
      try {
        const date = new Date(val);
        return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : null;
      } catch (error) {
        console.warn(`Invalid date format for Last_Stage_Change_Date: ${val}`);
        return null;
      }
    }
    return val;
  });

  // Author and SMEs fields - convert arrays to comma-separated strings
  populateField('Author', apiData.Author, (val) => {
    if (Array.isArray(val)) {
      return val.join(', ');
    }
    return val;
  });

  populateField('SMEs', apiData.SMEs, (val) => {
    if (Array.isArray(val)) {
      return val.join(', ');
    }
    return val;
  });
}

// FIXED: Helper function to check if document is actually published
async function checkIfDocumentIsPublished(documentId: string | number): Promise<boolean> {
  try {
    // Method 1: Direct database query to check publishedAt
    const dbDoc = await strapi.db.query('api::document-store.document-store').findOne({
      where: { id: documentId },
      select: ['id', 'publishedAt']
    });
    
    if (dbDoc && dbDoc.publishedAt !== null && dbDoc.publishedAt !== undefined) {
      console.log(`🟢 Document ${documentId} is published: publishedAt = ${dbDoc.publishedAt}`);
      return true;
    }
    
    console.log(`🔴 Document ${documentId} is not published: publishedAt = ${dbDoc?.publishedAt}`);
    return false;
    
  } catch (error) {
    console.error(`❌ Error checking published status for document ${documentId}:`, error);
    return false;
  }
}

// FIXED: Helper function to fetch full document for indexing
async function fetchFullDocumentForIndexing(documentId: string | number): Promise<any> {
  try {
    // Use entityService.findOne with populate (no publicationState)
    const fullDocument = await strapi.entityService.findOne('api::document-store.document-store', documentId, {
      populate: {
        Attachments: {
          fields: ['id', 'name', 'alternativeText', 'caption', 'url', 'ext', 'mime', 'size']
        }
      }
    });
    
    if (fullDocument) {
      console.log(`🟢 Fetched document ${documentId} with entityService`);
      return fullDocument;
    }
    
    // Fallback: Direct database query with populate
    const dbDocument = await strapi.db.query('api::document-store.document-store').findOne({
      where: { id: documentId },
      populate: {
        Attachments: true
      }
    });
    
    if (dbDocument) {
      console.log(`🔵 Fetched document ${documentId} via direct DB query`);
      return dbDocument;
    }
    
    throw new Error(`Document ${documentId} not found with any method`);
    
  } catch (error) {
    console.error(`❌ Error fetching document ${documentId} for indexing:`, error);
    throw error;
  }
}
// src/api/document-store/controllers/document-store.ts
// ENHANCED DEBUG VERSION - Let's see exactly what's happening

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  error?: string | null;
}

module.exports = ({ strapi }: { strapi: any }) => ({
  
  async find(ctx: any) {
    try {
      const { populate, publicationState, ...query } = ctx.query;
      
      const defaultPopulate = {
        Attachments: {
          fields: ['name', 'alternativeText', 'caption', 'width', 'height', 'formats', 'hash', 'ext', 'mime', 'size', 'url']
        }
      };
      
      const entities = await strapi.entityService.findMany('api::document-store.document-store', {
        ...query,
        populate: populate === '*' ? '*' : (populate || defaultPopulate),
        publicationState: publicationState || 'preview'
      });
      
      return ctx.send({
        data: entities
      });
      
    } catch (error) {
      strapi.log.error('Document find failed:', error);
      return ctx.internalServerError('Failed to fetch documents');
    }
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const { populate, publicationState, ...query } = ctx.query;
    
    try {
      const defaultPopulate = {
        Attachments: {
          fields: ['name', 'alternativeText', 'caption', 'width', 'height', 'formats', 'hash', 'ext', 'mime', 'size', 'url']
        }
      };
      
      const entity = await strapi.entityService.findOne('api::document-store.document-store', id, {
        ...query,
        populate: populate === '*' ? '*' : (populate || defaultPopulate),
        publicationState: publicationState || 'preview'
      });
      
      if (!entity) {
        return ctx.notFound('Document not found');
      }
      
      return ctx.send({
        data: entity
      });
      
    } catch (error) {
      strapi.log.error('Document findOne failed:', error);
      return ctx.internalServerError('Failed to fetch document');
    }
  },

  async create(ctx: any) {
    const { data } = ctx.request.body;
    
    if (data.SF_Number && !/^SF\d{3}$/.test(data.SF_Number)) {
      return ctx.badRequest('SF_Number must be in format SF001, SF002, etc.');
    }
    
    if (data.SF_Number) {
      const existing = await strapi.entityService.findMany('api::document-store.document-store', {
        filters: { SF_Number: data.SF_Number },
        publicationState: 'preview',
        limit: 1
      });
      
      if (existing && existing.length > 0) {
        return ctx.conflict(`Document with SF_Number ${data.SF_Number} already exists`);
      }
    }
    
    try {
      const entity = await strapi.entityService.create('api::document-store.document-store', {
        data: data,
        populate: {
          Attachments: {
            fields: ['name', 'alternativeText', 'caption', 'width', 'height', 'formats', 'hash', 'ext', 'mime', 'size', 'url']
          }
        }
      });
      
      return ctx.send({
        data: entity
      });
      
    } catch (error) {
      strapi.log.error('Document creation failed:', error);
      return ctx.internalServerError('Document creation failed');
    }
  },

  // COMPLETELY REWRITTEN UPDATE METHOD with extensive debugging
  async update(ctx: any) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;
    
    console.log('🔥 === DETAILED UPDATE DEBUG START ===');
    console.log('📝 Request ID:', id);
    console.log('📝 Request Data:', JSON.stringify(data, null, 2));
    console.log('📝 Data Type:', typeof data);
    console.log('📝 Data Keys:', Object.keys(data));
    
    if (data.SF_Number && !/^SF\d{3}$/.test(data.SF_Number)) {
      return ctx.badRequest('SF_Number must be in format SF001, SF002, etc.');
    }
    
    // Get current document state first
    try {
      const currentDoc = await strapi.entityService.findOne('api::document-store.document-store', id, {
        publicationState: 'preview'
      });
      
      if (!currentDoc) {
        console.log('❌ Document not found with ID:', id);
        return ctx.notFound('Document not found');
      }
      
      console.log('📋 Current Document State:');
      console.log('   - ID:', currentDoc.id);
      console.log('   - documentId:', currentDoc.documentId);
      console.log('   - SF_Number:', currentDoc.SF_Number);
      console.log('   - publishedAt (before):', currentDoc.publishedAt);
      console.log('   - publishedAt type:', typeof currentDoc.publishedAt);
      
    } catch (error) {
      console.log('❌ Error fetching current document:', error);
      return ctx.internalServerError('Error fetching document');
    }
    
    // Check for SF_Number uniqueness
    if (data.SF_Number) {
      const existing = await strapi.entityService.findMany('api::document-store.document-store', {
        filters: { 
          SF_Number: data.SF_Number,
          id: { $ne: id }
        },
        publicationState: 'preview',
        limit: 1
      });
      
      if (existing && existing.length > 0) {
        return ctx.conflict(`Another document with SF_Number ${data.SF_Number} already exists`);
      }
    }
    
    // Analyze publish operation
    const hasPublishedAt = data.hasOwnProperty('publishedAt');
    const publishedAtValue = data.publishedAt;
    
    console.log('📤 Publish Analysis:');
    console.log('   - hasPublishedAt:', hasPublishedAt);
    console.log('   - publishedAtValue:', publishedAtValue);
    console.log('   - publishedAtValue type:', typeof publishedAtValue);
    console.log('   - publishedAtValue === null:', publishedAtValue === null);
    console.log('   - publishedAtValue === undefined:', publishedAtValue === undefined);
    console.log('   - publishedAtValue === "":', publishedAtValue === "");
    
    // Prepare data for update
    let updateData = { ...data };
    let operationType = 'updated';
    
    if (hasPublishedAt) {
      if (publishedAtValue === null || publishedAtValue === '' || publishedAtValue === undefined) {
        // Unpublishing
        updateData.publishedAt = null;
        operationType = 'unpublished';
        console.log('📝 Operation: UNPUBLISH');
        console.log('   - Setting publishedAt to null');
      } else {
        // Publishing
        if (publishedAtValue === true || publishedAtValue === 'true' || publishedAtValue === '1') {
          updateData.publishedAt = new Date().toISOString();
          console.log('📝 Operation: PUBLISH (auto-generated timestamp)');
          console.log('   - Generated timestamp:', updateData.publishedAt);
        } else {
          updateData.publishedAt = publishedAtValue;
          console.log('📝 Operation: PUBLISH (provided timestamp)');
          console.log('   - Using provided timestamp:', updateData.publishedAt);
        }
        operationType = 'published';
      }
    }
    
    console.log('💾 Final Update Data:');
    console.log('   - updateData keys:', Object.keys(updateData));
    console.log('   - updateData.publishedAt:', updateData.publishedAt);
    console.log('   - updateData.publishedAt type:', typeof updateData.publishedAt);
    console.log('   - operationType:', operationType);
    
    // Perform the update
    try {
      console.log('🔄 Calling strapi.entityService.update...');
      
      const updatedEntity = await strapi.entityService.update('api::document-store.document-store', id, {
        data: updateData,
        populate: {
          Attachments: {
            fields: ['name', 'alternativeText', 'caption', 'width', 'height', 'formats', 'hash', 'ext', 'mime', 'size', 'url']
          }
        }
      });
      
      console.log('✅ Update completed successfully');
      console.log('📋 Updated Document State:');
      console.log('   - ID:', updatedEntity.id);
      console.log('   - documentId:', updatedEntity.documentId);
      console.log('   - SF_Number:', updatedEntity.SF_Number);
      console.log('   - publishedAt (after):', updatedEntity.publishedAt);
      console.log('   - publishedAt type:', typeof updatedEntity.publishedAt);
      console.log('   - updatedAt:', updatedEntity.updatedAt);
      
      // Verify the update worked
      if (hasPublishedAt) {
        if (operationType === 'published' && !updatedEntity.publishedAt) {
          console.log('🚨 WARNING: Tried to publish but publishedAt is still null/undefined');
          console.log('🚨 This indicates a database or lifecycle hook issue');
        } else if (operationType === 'unpublished' && updatedEntity.publishedAt) {
          console.log('🚨 WARNING: Tried to unpublish but publishedAt is still set');
        } else {
          console.log('✅ Publish operation successful');
        }
      }
      
      console.log('🔥 === DETAILED UPDATE DEBUG END ===');
      
      return ctx.send({
        data: updatedEntity,
        meta: {
          operation: operationType,
          previousState: 'determined by publishedAt value',
          newState: updatedEntity.publishedAt ? 'published' : 'draft',
          debug: {
            requestedOperation: operationType,
            finalPublishedAt: updatedEntity.publishedAt,
            updateSuccessful: true
          }
        }
      });
      
    } catch (error) {
      console.log('❌ Update failed with error:');
      console.log('   - Error message:', error.message);
      console.log('   - Error stack:', error.stack);
      console.log('🔥 === DETAILED UPDATE DEBUG END (ERROR) ===');
      
      strapi.log.error('Document update failed:', error);
      return ctx.internalServerError(`Document update failed: ${error.message}`);
    }
  },

  async delete(ctx: any) {
    const { id } = ctx.params;
    
    try {
      const entity = await strapi.entityService.delete('api::document-store.document-store', id);
      return ctx.send({ data: entity });
    } catch (error) {
      strapi.log.error('Document delete failed:', error);
      return ctx.internalServerError('Failed to delete document');
    }
  },

  async autoPopulate(ctx: any) {
    try {
      const { id } = ctx.params;
      
      const document = await strapi.entityService.findOne('api::document-store.document-store', id, {
        publicationState: 'preview'
      });
      
      if (!document) {
        return ctx.notFound('Document not found');
      }
      
      if (!document.SF_Number) {
        return ctx.badRequest('Document must have SF_Number to auto-populate');
      }
      
      const service = strapi.service('api::document-store.document-store');
      const apiData = await service.fetchSFOperationData(document.SF_Number);
      
      if (!apiData || !apiData.success) {
        return ctx.badRequest('Failed to fetch data from external API');
      }
      
      const updatedDocument = await strapi.entityService.update('api::document-store.document-store', id, {
        data: {
          manualOverride: true,
          ...apiData.data
        },
        populate: {
          Attachments: {
            fields: ['name', 'alternativeText', 'caption', 'width', 'height', 'formats', 'hash', 'ext', 'mime', 'size', 'url']
          }
        }
      });
      
      return ctx.send({
        data: updatedDocument,
        meta: {
          message: 'Document auto-populated successfully',
          source: 'manual_trigger'
        }
      });
      
    } catch (error) {
      strapi.log.error('Manual auto-population failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return ctx.internalServerError('Auto-population failed: ' + errorMessage);
    }
  },

  async health(ctx: any) {
    try {
      const service = strapi.service('api::document-store.document-store');
      const health = await service.healthCheck();
      
      const overallStatus = Object.values(health)
        .every((h: any) => h.status === 'healthy') ? 'healthy' : 'degraded';
      
      return ctx.send({
        status: overallStatus,
        services: health,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      strapi.log.error('Health check failed:', error);
      return ctx.internalServerError('Health check failed');
    }
  }
});
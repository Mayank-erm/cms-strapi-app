import axios from 'axios';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  error?: string | null;
}

interface Health {
  fastapi: HealthStatus;
  meilisearch: HealthStatus;
}

module.exports = ({ strapi }: { strapi: any }) => ({
  
  async fetchSFOperationData(sfNumber: string) {
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(`${process.env.FASTAPI_BASE_URL}/api/salesforce/document/${sfNumber}`, {
          headers: {
            'Authorization': `Bearer ${process.env.FASTAPI_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        return response.data;
        
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  },

  async healthCheck(): Promise<Health> {
    const health: Health = {
      fastapi: { status: 'unknown', error: null },
      meilisearch: { status: 'unknown', error: null }
    };

    // Check FastAPI
    try {
      await axios.get(`${process.env.FASTAPI_BASE_URL}/health`, { timeout: 5000 });
      health.fastapi.status = 'healthy';
    } catch (error) {
      health.fastapi.status = 'unhealthy';
      health.fastapi.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check MeiliSearch
    try {
      const { MeiliSearch } = require('meilisearch');
      const meilisearch = new MeiliSearch({
        host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILISEARCH_API_KEY,
      });
      
      await meilisearch.health();
      health.meilisearch.status = 'healthy';
    } catch (error) {
      health.meilisearch.status = 'unhealthy';
      health.meilisearch.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return health;
  }
});
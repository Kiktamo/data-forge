const fs = require('fs').promises;
const path = require('path');
// const { Configuration, OpenAIApi } = require('openai');

class EmbeddingService {
  constructor() {
    // I'm not currently using OpenAI embeddings, but keeping this for future use
    // this.openai = new OpenAIApi(new Configuration({
    //   apiKey: process.env.OPENAI_API_KEY
    // }));
    
    // Alternative: Use local embedding models with @xenova/transformers
    this.useLocal = !process.env.OPENAI_API_KEY;
  }

  // Main entry point: generate embedding for any contribution
  async generateContributionEmbedding(contribution) {
    try {
      const textContent = await this.extractTextContent(contribution);
      
      if (!textContent.trim()) {
        console.warn(`No content to embed for contribution ${contribution.id}`);
        return null;
      }

      // Generate embedding from combined text
      const embedding = await this.generateEmbedding(textContent);
      
      return {
        contributionId: contribution.id,
        embedding: embedding,
        content: textContent.substring(0, 500), // Store excerpt for debugging
        extractedAt: new Date()
      };
      
    } catch (error) {
      console.error(`Error generating embedding for contribution ${contribution.id}:`, error);
      return null;
    }
  }

  // Extract meaningful text content from any contribution type
  async extractTextContent(contribution) {
    const parts = [];
    
    // Add basic metadata
    if (contribution.metadata?.description) {
      parts.push(`Description: ${contribution.metadata.description}`);
    }
    
    if (contribution.metadata?.tags?.length) {
      parts.push(`Tags: ${contribution.metadata.tags.join(', ')}`);
    }

    // Extract content based on data type
    switch (contribution.dataType) {
      case 'text':
        const textContent = await this.extractTextData(contribution);
        if (textContent) parts.push(`Content: ${textContent}`);
        break;
        
      case 'image':
        const imageMetadata = await this.extractImageMetadata(contribution);
        if (imageMetadata) parts.push(imageMetadata);
        break;
        
      case 'structured':
        const structuredSummary = await this.extractStructuredSummary(contribution);
        if (structuredSummary) parts.push(structuredSummary);
        break;
    }

    // Add annotations if present
    if (contribution.content?.annotations) {
      const annotationText = this.extractAnnotations(contribution.content.annotations);
      if (annotationText) parts.push(`Annotations: ${annotationText}`);
    }

    return parts.join('\n\n');
  }

  // Extract text content from text contributions
  async extractTextData(contribution) {
    try {
      if (contribution.content?.text) {
        // Direct text content
        return contribution.content.text;
      }
      
      if (contribution.content?.file?.filename) {
        // Read text from file
        const filePath = this.resolveFilePath(contribution, 'text');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return fileContent.substring(0, 10000); // Limit length
      }
      
    } catch (error) {
      console.warn(`Could not extract text content for contribution ${contribution.id}:`, error.message);
    }
    
    return '';
  }

  // Extract metadata from image contributions
  async extractImageMetadata(contribution) {
    const parts = [];
    
    if (contribution.content?.file) {
      const file = contribution.content.file;
      parts.push(`Image file: ${file.originalName || file.filename}`);
      
      if (file.mimetype) parts.push(`Type: ${file.mimetype}`);
      if (file.size) parts.push(`Size: ${this.formatFileSize(file.size)}`);
    }

    // Future enhancement: Add actual image analysis
    // const imageAnalysis = await this.analyzeImage(filePath);
    // if (imageAnalysis) parts.push(`Visual content: ${imageAnalysis}`);

    return parts.join(', ');
  }

  // Extract summary from structured data
  async extractStructuredSummary(contribution) {
    try {
      if (contribution.content?.data) {
        // Direct structured data
        const data = contribution.content.data;
        const summary = this.analyzeStructuredData(data);
        return summary;
      }
      
      if (contribution.content?.file?.filename) {
        // Analyze structured file (CSV, JSON)
        const filePath = this.resolveFilePath(contribution, 'structured');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        
        const ext = path.extname(contribution.content.file.filename).toLowerCase();
        let parsedData;
        
        if (ext === '.json') {
          parsedData = JSON.parse(fileContent);
        } else if (ext === '.csv') {
          // Simple CSV parsing for analysis
          const lines = fileContent.split('\n').filter(line => line.trim());
          const headers = lines[0]?.split(',') || [];
          parsedData = { headers, sampleRows: lines.slice(1, 6) };
        }
        
        return this.analyzeStructuredData(parsedData);
      }
      
    } catch (error) {
      console.warn(`Could not extract structured data for contribution ${contribution.id}:`, error.message);
    }
    
    return '';
  }

  // Analyze structured data and create text summary
  analyzeStructuredData(data) {
    const parts = [];
    
    if (Array.isArray(data)) {
      parts.push(`Array with ${data.length} items`);
      if (data.length > 0) {
        const sampleItem = data[0];
        if (typeof sampleItem === 'object') {
          const keys = Object.keys(sampleItem);
          parts.push(`Fields: ${keys.join(', ')}`);
        }
      }
    } else if (typeof data === 'object') {
      if (data.headers) {
        // CSV-like data
        parts.push(`CSV with columns: ${data.headers.join(', ')}`);
        if (data.sampleRows) {
          parts.push(`${data.sampleRows.length} sample rows`);
        }
      } else {
        // Regular object
        const keys = Object.keys(data);
        parts.push(`Object with fields: ${keys.join(', ')}`);
      }
    }
    
    return parts.join('. ');
  }

  // Extract meaningful text from annotations
  extractAnnotations(annotations) {
    const parts = [];
    
    if (typeof annotations === 'object') {
      for (const [key, value] of Object.entries(annotations)) {
        if (typeof value === 'string' && value.trim()) {
          parts.push(`${key}: ${value}`);
        }
      }
    }
    
    return parts.join(', ');
  }

  // Resolve file path using same strategy as export
  resolveFilePath(contribution, dataType) {
    const typeFolderMap = {
      'image': 'images',
      'text': 'text', 
      'structured': 'structured'
    };
    
    const filename = contribution.content.file.filename;
    const typeFolder = contribution.content.file.typeFolder || typeFolderMap[dataType];
    
    return path.join(__dirname, '../../uploads/contributions', typeFolder, filename);
  }

  // Generate actual embedding vector
  async generateEmbedding(text) {
    if (this.useLocal) {
      // Use local embedding model (install @xenova/transformers)
      return await this.generateLocalEmbedding(text);
    } else {
      // Use OpenAI embeddings
      return await this.generateOpenAIEmbedding(text);
    }
  }

  // Local embedding using Xenova transformers
  async generateLocalEmbedding(text) {
    try {
      // This would require: npm install @xenova/transformers
      const { pipeline } = await import('@xenova/transformers');
      
      if (!this.embedder) {
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      }
      
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
      
    } catch (error) {
      console.error('Local embedding failed:', error);
      // Fallback: simple hash-based embedding (for testing)
      return this.generateSimpleEmbedding(text);
    }
  }

  // OpenAI embedding (requires API key)
  async generateOpenAIEmbedding(text) {
    try {
      const response = await this.openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000) // OpenAI token limit
      });
      
      return response.data.data[0].embedding;
      
    } catch (error) {
      console.error('OpenAI embedding failed:', error);
      return this.generateSimpleEmbedding(text);
    }
  }

  // Simple fallback embedding (for development/testing)
  generateSimpleEmbedding(text) {
    // Create a simple vector based on text characteristics
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(384).fill(0); // Same size as MiniLM
    
    // Simple hash-based features
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = this.simpleHash(word);
      vector[hash % vector.length] += 1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  // Simple hash function
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Utility functions
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = new EmbeddingService();
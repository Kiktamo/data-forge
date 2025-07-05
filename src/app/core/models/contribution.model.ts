export interface Contribution {
  id: number;
  datasetId: number;
  contributorId: number;
  dataType: 'image' | 'text' | 'structured';
  content: any; // Structure varies based on data type
  metadata: {
    description?: string;
    tags?: string[];
    annotations?: any;
    [key: string]: any;
  };
  validationStatus: 'pending' | 'approved' | 'rejected';
  validatedBy?: number[];
  validationNotes?: string;
  qualityScore?: number;
  isActive: boolean;
  created_at: Date;
  updated_at: Date;
  
  // Related data (from joins)
  contributor?: {
    id: number;
    username: string;
    fullName?: string;
  };
  dataset?: {
    id: number;
    name: string;
    description?: string;
    dataType: string;
    visibility: string;
    ownerId?: number;
  };
  
  // Duplicate detection data (added by enhanced API endpoints)
  duplicateDetection?: {
    hasEmbedding: boolean;
    similarCount?: number;
    highSimilarityCount?: number;
    topSimilarities?: Array<{
      contributionId: number;
      similarity: number;
      contentExcerpt: string;
    }>;
    error?: string;
    message?: string;
  };
}
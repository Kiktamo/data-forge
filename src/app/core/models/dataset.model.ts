export interface Dataset {
  id: number;
  name: string;
  description?: string;
  ownerId: number;
  visibility: 'public' | 'private' | 'collaborative';
  dataType: 'image' | 'text' | 'structured';
  currentVersion: string;
  tags: string[];
  contributionCount: number;
  validationCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  created_at: Date;
  updated_at: Date;
  // Owner information (from join)
  owner?: {
    id: number;
    username: string;
    fullName?: string;
  };
}

export interface DatasetListResponse {
  success: boolean;
  data: {
    datasets: Dataset[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface DatasetResponse {
  success: boolean;
  data: {
    dataset: Dataset;
  };
  message?: string;
}

export interface DatasetStatsResponse {
  success: boolean;
  data: {
    stats: {
      totalContributions: number;
      validatedContributions: number;
      pendingValidations: number;
      currentVersion: string;
      created_at: Date;
      lastUpdated: Date;
      tags: string[];
      dataType: string;
    };
  };
}

export interface DatasetHistoryResponse {
  success: boolean;
  data: {
    history: Array<Dataset & { version: Date; isHistorical: boolean }>;
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  visibility?: 'public' | 'private' | 'collaborative';
  dataType: 'image' | 'text' | 'structured';
  tags?: string[];
}

export interface UpdateDatasetRequest {
  name?: string;
  description?: string;
  visibility?: 'public' | 'private' | 'collaborative';
  tags?: string[];
}

export interface DatasetQueryParams {
  page?: number;
  limit?: number;
  visibility?: 'public' | 'private' | 'collaborative';
  dataType?: 'image' | 'text' | 'structured';
  search?: string;
  tags?: string | string[];
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'contributionCount';
  sortOrder?: 'ASC' | 'DESC';
  userId?: number;
}
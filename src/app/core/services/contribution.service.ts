import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Contribution } from '../models/contribution.model';

export interface ContributionListResponse {
  success: boolean;
  data: {
    contributions: Contribution[];
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

export interface ContributionResponse {
  success: boolean;
  data: {
    contribution: Contribution;
    validationSummary?: ValidationSummary;
  };
  message?: string;
}

export interface ValidationSummary {
  totalValidations: number;
  approved: number;
  rejected: number;
  needsReview: number;
  averageConfidence: number;
  validations: Validation[];
}

export interface Validation {
  id: number;
  contributionId: number;
  validatorId: number;
  status: 'approved' | 'rejected' | 'needs_review';
  confidence?: number;
  notes?: string;
  validationCriteria?: any;
  timeSpent?: number;
  created_at: Date;  // FIXED: changed from createdAt
  updated_at: Date;  // FIXED: changed from updatedAt
  validator?: {
    id: number;
    username: string;
    fullName?: string;
  };
}

export interface ContributionQueryParams {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected';
  contributorId?: number;
  datasetId?: number;
  dataType?: 'image' | 'text' | 'structured';
  sortBy?: 'created_at' | 'updated_at' | 'validationStatus' | 'dataType';
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable({
  providedIn: 'root'
})
export class ContributionService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}
  
  // Get contributions for a dataset
getContributionsByDataset(datasetId: number, params: ContributionQueryParams = {}): Observable<ContributionListResponse> {
  
  return this.http.get<ContributionListResponse>(`${this.apiUrl}/datasets/${datasetId}/contributions`, { params: params as any }).pipe(
    map(response => {
      
      // Process each contribution to handle date fields
      response.data.contributions = response.data.contributions.map(contribution => 
        this.processContributionResponse(contribution)
      );
      
      return response;
    })
  );
}
  
  // Get single contribution by ID
getContributionById(id: number): Observable<ContributionResponse> {
  
  return this.http.get<ContributionResponse>(`${this.apiUrl}/contributions/${id}`).pipe(
    map(response => {
      
      if (response.data.contribution) {
        response.data.contribution = this.processContributionResponse(response.data.contribution);
      }
      
      return response;
    })
  );
}
  
  // Create new contribution
  createContribution(datasetId: number, formData: FormData): Observable<ContributionResponse> {
    return this.http.post<ContributionResponse>(`${this.apiUrl}/datasets/${datasetId}/contributions`, formData);
  }
  
  // Update contribution
  updateContribution(id: number, updates: any): Observable<ContributionResponse> {
    return this.http.put<ContributionResponse>(`${this.apiUrl}/contributions/${id}`, updates);
  }
  
  // Delete contribution
  deleteContribution(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/contributions/${id}`);
  }
  
  // Get user's contributions
getUserContributions(userId: number, params: ContributionQueryParams = {}): Observable<ContributionListResponse> {
  
  return this.http.get<ContributionListResponse>(`${this.apiUrl}/users/${userId}/contributions`, { params: params as any }).pipe(
    map(response => {
      // Process each contribution to handle date fields
      response.data.contributions = response.data.contributions.map(contribution => 
        this.processContributionResponse(contribution)
      );
      
      return response;
    })
  );
}

  private processContributionResponse(contribution: any): any {
  return {
    ...contribution,
    // Handle both camelCase and snake_case date fields
    created_at: contribution.created_at ? new Date(contribution.created_at) : 
               (contribution.createdAt ? new Date(contribution.createdAt) : new Date()),
    updated_at: contribution.updated_at ? new Date(contribution.updated_at) : 
               (contribution.updatedAt ? new Date(contribution.updatedAt) : new Date())
  };
}
  
// Validation methods
createValidation(contributionId: number, validation: {
  status: 'approved' | 'rejected' | 'needs_review';
  confidence?: number;
  notes?: string;
  validationCriteria?: any; // Will be converted to JSON string
  timeSpent?: number;
}): Observable<{ success: boolean; data: { validation: Validation }; message?: string }> {
  
  // Debug logging
  // console.log('ContributionService.createValidation called with:');
  // console.log('Contribution ID:', contributionId);
  // console.log('Raw validation data:', validation);
  
  // Convert validationCriteria to JSON string if it's an object
  let processedValidation = { ...validation };
  
  if (validation.validationCriteria && typeof validation.validationCriteria === 'object') {
    processedValidation.validationCriteria = JSON.stringify(validation.validationCriteria);
  } else if (validation.validationCriteria && typeof validation.validationCriteria === 'string') {
    // Already a string, keep as is
    processedValidation.validationCriteria = validation.validationCriteria;
  } else {
    // Provide default empty JSON object
    processedValidation.validationCriteria = '{}';
  }
  
  // Ensure confidence is a proper number
  if (processedValidation.confidence !== undefined) {
    processedValidation.confidence = Number(processedValidation.confidence);
  }
  
  // Ensure timeSpent is a proper number
  if (processedValidation.timeSpent !== undefined) {
    processedValidation.timeSpent = Number(processedValidation.timeSpent);
  }
  
  // Ensure notes is a string
  if (processedValidation.notes === undefined || processedValidation.notes === null) {
    processedValidation.notes = '';
  }

  // console.log('Processed validation data:', processedValidation);
  // console.log('Making request to:', `${this.apiUrl}/contributions/${contributionId}/validations`);

  return this.http.post<any>(
    `${this.apiUrl}/contributions/${contributionId}/validations`, 
    processedValidation
  );
}
  
  // Get validations for a contribution
  getValidationsForContribution(contributionId: number): Observable<{ success: boolean; data: ValidationSummary }> {
    return this.http.get<any>(`${this.apiUrl}/contributions/${contributionId}/validations`);
  }
  
  // Get pending contributions for validation
  getPendingContributions(params: ContributionQueryParams = {}): Observable<ContributionListResponse> {
    return this.http.get<ContributionListResponse>(`${this.apiUrl}/validations/pending`, { params: params as any });
  }
  
  // Update validation
  updateValidation(id: number, updates: {
    status?: 'approved' | 'rejected' | 'needs_review';
    confidence?: number;
    notes?: string;
    validationCriteria?: any;
    timeSpent?: number;
  }): Observable<{ success: boolean; data: { validation: Validation }; message?: string }> {
    return this.http.put<any>(`${this.apiUrl}/validations/${id}`, updates);
  }
  
  // Get file URL for contribution files
getContributionFileUrl(contribution: Contribution): string | null {
  if (!contribution.content?.file?.filename) {
    return null;
  }
  
  const type = contribution.dataType === 'image' ? 'images' :
               contribution.dataType === 'text' ? 'text' : 'structured';
  
  const baseUrl = `${environment.apiUrl}/files/contributions/${type}/${contribution.content.file.filename}`;
  
  // Add token for authenticated requests if available
  const token = localStorage.getItem('accessToken');
  if (token) {
    return `${baseUrl}?token=${encodeURIComponent(token)}`;
  }
  
  return baseUrl;
}
  
  // Get thumbnail URL for image contributions
  getContributionThumbnailUrl(contribution: Contribution): string | null {
    if (contribution.dataType !== 'image' || !contribution.content?.file?.filename) {
      return null;
    }
    
    const baseUrl = `${environment.apiUrl}/files/contributions/images/${contribution.content.file.filename}/thumbnail`;
    
    // Add token for authenticated requests if available
    const token = localStorage.getItem('accessToken');
    if (token) {
      return `${baseUrl}?token=${encodeURIComponent(token)}`;
    }
    
    return baseUrl;
  }
  
  // Get file info/metadata
  getContributionFileInfo(contribution: Contribution): Observable<any> {
    if (!contribution.content?.file?.filename) {
      throw new Error('No file associated with this contribution');
    }
    
    const type = contribution.dataType === 'image' ? 'images' :
                 contribution.dataType === 'text' ? 'text' : 'structured';
    
    return this.http.get(`${environment.apiUrl}/files/contributions/${type}/${contribution.content.file.filename}/info`);
  }
}
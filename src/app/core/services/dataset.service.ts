import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environments';
import { 
  Dataset, 
  DatasetListResponse, 
  DatasetResponse, 
  DatasetStatsResponse,
  DatasetHistoryResponse,
  CreateDatasetRequest, 
  UpdateDatasetRequest,
  DatasetQueryParams 
} from '../models/dataset.model';

@Injectable({
  providedIn: 'root'
})
export class DatasetService {
  private apiUrl = `${environment.apiUrl}/datasets`;

  constructor(private http: HttpClient) {}

  // Get datasets with filtering, pagination, and search
  getDatasets(params: DatasetQueryParams = {}): Observable<DatasetListResponse> {
    let httpParams = new HttpParams();
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      const value = params[key as keyof DatasetQueryParams];
      if (value !== undefined && value !== null) {
        // Skip empty strings for string values, but allow 0 for numbers
        if (typeof value === 'string' && value === '') {
          return;
        }
        if (Array.isArray(value)) {
          // Handle array values (like tags)
          value.forEach(item => httpParams = httpParams.append(key, item.toString()));
        } else {
          httpParams = httpParams.set(key, value.toString());
        }
      }
    });

    return this.http.get<DatasetListResponse>(this.apiUrl, { params: httpParams }).pipe(
      map(response => {
        // Convert date strings to Date objects
        response.data.datasets = response.data.datasets.map(dataset => ({
          ...dataset,
          createdAt: new Date(dataset.createdAt),
          updatedAt: new Date(dataset.updatedAt)
        }));
        return response;
      })
    );
  }

  // Get single dataset by ID
  getDatasetById(id: number): Observable<Dataset> {
    return this.http.get<DatasetResponse>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        const dataset = response.data.dataset;
        return {
          ...dataset,
          createdAt: new Date(dataset.createdAt),
          updatedAt: new Date(dataset.updatedAt)
        };
      })
    );
  }

  // Get datasets by user ID
  getUserDatasets(userId: number, params: DatasetQueryParams = {}): Observable<DatasetListResponse> {
    let httpParams = new HttpParams();
    
    Object.keys(params).forEach(key => {
      const value = params[key as keyof DatasetQueryParams];
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && value === '') {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(item => httpParams = httpParams.append(key, item.toString()));
        } else {
          httpParams = httpParams.set(key, value.toString());
        }
      }
    });

    return this.http.get<DatasetListResponse>(`${this.apiUrl}/user/${userId}`, { params: httpParams }).pipe(
      map(response => {
        response.data.datasets = response.data.datasets.map(dataset => ({
          ...dataset,
          createdAt: new Date(dataset.createdAt),
          updatedAt: new Date(dataset.updatedAt)
        }));
        return response;
      })
    );
  }

  // Create new dataset
  createDataset(dataset: CreateDatasetRequest): Observable<Dataset> {
    return this.http.post<DatasetResponse>(this.apiUrl, dataset).pipe(
      map(response => {
        const dataset = response.data.dataset;
        return {
          ...dataset,
          createdAt: new Date(dataset.createdAt),
          updatedAt: new Date(dataset.updatedAt)
        };
      })
    );
  }

  // Update existing dataset
  updateDataset(id: number, updates: UpdateDatasetRequest): Observable<Dataset> {
    return this.http.put<DatasetResponse>(`${this.apiUrl}/${id}`, updates).pipe(
      map(response => {
        const dataset = response.data.dataset;
        return {
          ...dataset,
          createdAt: new Date(dataset.createdAt),
          updatedAt: new Date(dataset.updatedAt)
        };
      })
    );
  }

  // Delete dataset
  deleteDataset(id: number): Observable<void> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`).pipe(
      map(() => void 0)
    );
  }

  // Get dataset statistics
  getDatasetStats(id: number): Observable<DatasetStatsResponse['data']['stats']> {
    return this.http.get<DatasetStatsResponse>(`${this.apiUrl}/${id}/stats`).pipe(
      map(response => ({
        ...response.data.stats,
        createdAt: new Date(response.data.stats.createdAt),
        lastUpdated: new Date(response.data.stats.lastUpdated)
      }))
    );
  }

  // Get dataset history/versions
  getDatasetHistory(id: number, params: { page?: number; limit?: number; sortOrder?: 'ASC' | 'DESC' } = {}): Observable<DatasetHistoryResponse> {
    let httpParams = new HttpParams();
    
    Object.keys(params).forEach(key => {
      const value = params[key as keyof typeof params];
      // Ignore unintentional error in editor. value !== '' is indeed not nessesary for sortOrder but relevant for other params.
      // @ts-ignore
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http.get<DatasetHistoryResponse>(`${this.apiUrl}/${id}/history`, { params: httpParams }).pipe(
      map(response => {
        response.data.history = response.data.history.map(version => ({
          ...version,
          createdAt: new Date(version.createdAt),
          updatedAt: new Date(version.updatedAt),
          version: new Date(version.version)
        }));
        return response;
      })
    );
  }

  // Create new version of dataset
  createDatasetVersion(id: number, versionData: { versionDescription?: string; incrementType?: 'major' | 'minor' | 'patch' }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/version`, versionData);
  }

  // Get public datasets (shorthand method)
  getPublicDatasets(params: Omit<DatasetQueryParams, 'visibility'> = {}): Observable<DatasetListResponse> {
    return this.getDatasets({ ...params, visibility: 'public' });
  }

  // Search datasets (shorthand method)
  searchDatasets(query: string, params: DatasetQueryParams = {}): Observable<DatasetListResponse> {
    return this.getDatasets({ ...params, search: query });
  }

  // Get datasets by data type (shorthand method)
  getDatasetsByType(dataType: 'image' | 'text' | 'structured', params: Omit<DatasetQueryParams, 'dataType'> = {}): Observable<DatasetListResponse> {
    return this.getDatasets({ ...params, dataType });
  }

  // Get datasets by tags (shorthand method)
  getDatasetsByTags(tags: string[], params: Omit<DatasetQueryParams, 'tags'> = {}): Observable<DatasetListResponse> {
    return this.getDatasets({ ...params, tags });
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environments';
import { saveAs } from 'file-saver';
import {
  Dataset,
  DatasetListResponse,
  DatasetResponse,
  DatasetStatsResponse,
  DatasetHistoryResponse,
  CreateDatasetRequest,
  UpdateDatasetRequest,
  DatasetQueryParams,
} from '../models/dataset.model';

export interface ExportOptions {
  format: 'json' | 'csv' | 'zip';
  includeRejected?: boolean;
  includePending?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class DatasetService {
  private apiUrl = `${environment.apiUrl}/datasets`;

  constructor(private http: HttpClient) {}

  // Get datasets with filtering, pagination, and search
  getDatasets(
    params: DatasetQueryParams = {}
  ): Observable<DatasetListResponse> {
    let httpParams = new HttpParams();

    // Add query parameters
    Object.keys(params).forEach((key) => {
      const value = params[key as keyof DatasetQueryParams];
      if (value !== undefined && value !== null) {
        // Skip empty strings for string values, but allow 0 for numbers
        if (typeof value === 'string' && value === '') {
          return;
        }
        if (Array.isArray(value)) {
          // Handle array values (like tags)
          value.forEach(
            (item) => (httpParams = httpParams.append(key, item.toString()))
          );
        } else {
          httpParams = httpParams.set(key, value.toString());
        }
      }
    });

    // console.log('Dataset service making request with params:', params);
    // console.log('HTTP params:', httpParams.toString());

    return this.http
      .get<DatasetListResponse>(this.apiUrl, { params: httpParams })
      .pipe(
        map((response) => {
          // console.log('Raw dataset service response:', response);

          // FIXED: Handle both camelCase and snake_case date fields
          response.data.datasets = response.data.datasets.map((dataset) => ({
            ...dataset,
            // Handle both naming conventions
            created_at: dataset.created_at
              ? new Date(dataset.created_at)
              : dataset.createdAt
              ? new Date(dataset.createdAt)
              : new Date(),
            updated_at: dataset.updated_at
              ? new Date(dataset.updated_at)
              : dataset.updatedAt
              ? new Date(dataset.updatedAt)
              : new Date(),
          }));

          // console.log('Processed datasets:', response.data.datasets);
          return response;
        })
      );
  }

  // Get single dataset by ID
  getDatasetById(id: number): Observable<Dataset> {
    return this.http.get<DatasetResponse>(`${this.apiUrl}/${id}`).pipe(
      map((response) => {
        // console.log('Single dataset response:', response);
        const dataset = response.data.dataset;
        return {
          ...dataset,
          created_at: dataset.created_at
            ? new Date(dataset.created_at)
            : dataset.createdAt
            ? new Date(dataset.createdAt)
            : new Date(),
          updated_at: dataset.updated_at
            ? new Date(dataset.updated_at)
            : dataset.updatedAt
            ? new Date(dataset.updatedAt)
            : new Date(),
        };
      })
    );
  }

  // Get datasets by user ID
  getUserDatasets(
    userId: number,
    params: DatasetQueryParams = {}
  ): Observable<DatasetListResponse> {
    let httpParams = new HttpParams();

    // Add userId as a parameter instead of in the URL path
    const allParams = { ...params, userId };

    Object.keys(allParams).forEach((key) => {
      const value = allParams[key as keyof typeof allParams];
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && value === '') {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(
            (item) => (httpParams = httpParams.append(key, item.toString()))
          );
        } else {
          httpParams = httpParams.set(key, value.toString());
        }
      }
    });

    // console.log('Getting user datasets with params:', allParams);

    // FIXED: Use the main datasets endpoint with userId parameter
    return this.http
      .get<DatasetListResponse>(this.apiUrl, { params: httpParams })
      .pipe(
        map((response) => {
          // console.log('User datasets response:', response);

          response.data.datasets = response.data.datasets.map((dataset) => ({
            ...dataset,
            created_at: dataset.created_at
              ? new Date(dataset.created_at)
              : dataset.createdAt
              ? new Date(dataset.createdAt)
              : new Date(),
            updated_at: dataset.updated_at
              ? new Date(dataset.updated_at)
              : dataset.updatedAt
              ? new Date(dataset.updatedAt)
              : new Date(),
          }));
          return response;
        })
      );
  }

  // Create new dataset
  createDataset(dataset: CreateDatasetRequest): Observable<Dataset> {
    return this.http.post<DatasetResponse>(this.apiUrl, dataset).pipe(
      map((response) => {
        const dataset = response.data.dataset;
        return {
          ...dataset,
          created_at: new Date(dataset.created_at),
          updated_at: new Date(dataset.updated_at),
        };
      })
    );
  }

  // Update existing dataset
  updateDataset(
    id: number,
    updates: UpdateDatasetRequest
  ): Observable<Dataset> {
    return this.http.put<DatasetResponse>(`${this.apiUrl}/${id}`, updates).pipe(
      map((response) => {
        const dataset = response.data.dataset;
        return {
          ...dataset,
          created_at: new Date(dataset.created_at),
          updated_at: new Date(dataset.updated_at),
        };
      })
    );
  }

  // Delete dataset
  deleteDataset(id: number): Observable<void> {
    return this.http
      .delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }

  // Get dataset statistics
  getDatasetStats(
    id: number
  ): Observable<DatasetStatsResponse['data']['stats']> {
    return this.http
      .get<DatasetStatsResponse>(`${this.apiUrl}/${id}/stats`)
      .pipe(
        map((response) => ({
          ...response.data.stats,
          created_at: new Date(response.data.stats.created_at),
          lastUpdated: new Date(response.data.stats.lastUpdated),
        }))
      );
  }

  // Get dataset history/versions
  getDatasetHistory(
    id: number,
    params: { page?: number; limit?: number; sortOrder?: 'ASC' | 'DESC' } = {}
  ): Observable<DatasetHistoryResponse> {
    let httpParams = new HttpParams();

    Object.keys(params).forEach((key) => {
      const value = params[key as keyof typeof params];
      // Ignore unintentional error in editor. value !== '' is indeed not nessesary for sortOrder but relevant for other params.
      // @ts-ignore
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http
      .get<DatasetHistoryResponse>(`${this.apiUrl}/${id}/history`, {
        params: httpParams,
      })
      .pipe(
        map((response) => {
          response.data.history = response.data.history.map((version) => ({
            ...version,
            created_at: new Date(version.created_at),
            updated_at: new Date(version.updated_at),
            version: new Date(version.version),
          }));
          return response;
        })
      );
  }

  // Create new version of dataset
  createDatasetVersion(
    id: number,
    versionData: {
      versionDescription?: string;
      incrementType?: 'major' | 'minor' | 'patch';
    }
  ): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/version`, versionData);
  }

  // Get public datasets (shorthand method)
  getPublicDatasets(
    params: Omit<DatasetQueryParams, 'visibility'> = {}
  ): Observable<DatasetListResponse> {
    return this.getDatasets({ ...params, visibility: 'public' });
  }

  // Search datasets (shorthand method)
  searchDatasets(
    query: string,
    params: DatasetQueryParams = {}
  ): Observable<DatasetListResponse> {
    return this.getDatasets({ ...params, search: query });
  }

  // Get datasets by data type (shorthand method)
  getDatasetsByType(
    dataType: 'image' | 'text' | 'structured',
    params: Omit<DatasetQueryParams, 'dataType'> = {}
  ): Observable<DatasetListResponse> {
    return this.getDatasets({ ...params, dataType });
  }

  // Get datasets by tags (shorthand method)
  getDatasetsByTags(
    tags: string[],
    params: Omit<DatasetQueryParams, 'tags'> = {}
  ): Observable<DatasetListResponse> {
    return this.getDatasets({ ...params, tags });
  }

  exportDataset(
    datasetId: number,
    options: ExportOptions
  ): Observable<void> {
    const params = new HttpParams()
      .set('format', options.format)
      .set('includeRejected', options.includeRejected?.toString() || 'false')
      .set('includePending', options.includePending?.toString() || 'false');

    return this.http
      .get(`${this.apiUrl}/${datasetId}/export`, {
        params,
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((response) => {
          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers.get(
            'Content-Disposition'
          );
          let filename = `dataset_export.${options.format}`;

          if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
              contentDisposition
            );
            if (matches != null && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          }

          // Save the file using file-saver
          if (response.body) {
            saveAs(response.body, filename);
          }

          return void 0;
        })
        // catchError(this.handleError)
      );
  }

  // Get export preview/info (without downloading)
  getExportInfo(datasetId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${datasetId}/stats`).pipe(
      map((response: any) => {
        if (response.success && response.data) {
          return response.data.stats;
        } else {
          throw new Error('Failed to fetch export info');
        }
      })
      // catchError(this.handleError)
    );
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Dataset } from '../models/dataset.model';

@Injectable({
  providedIn: 'root'
})
export class DatasetService {
  constructor(private http: HttpClient) {}
  
  getDatasets(): Observable<Dataset[]> {
    return this.http.get<Dataset[]>('/api/datasets');
  }
  
  getDatasetById(id: string): Observable<Dataset> {
    return this.http.get<Dataset>(`/api/datasets/${id}`);
  }
  
  createDataset(dataset: Partial<Dataset>): Observable<Dataset> {
    return this.http.post<Dataset>('/api/datasets', dataset);
  }
  
  updateDataset(id: string, updates: Partial<Dataset>): Observable<Dataset> {
    return this.http.put<Dataset>(`/api/datasets/${id}`, updates);
  }
  
  deleteDataset(id: string): Observable<void> {
    return this.http.delete<void>(`/api/datasets/${id}`);
  }
}
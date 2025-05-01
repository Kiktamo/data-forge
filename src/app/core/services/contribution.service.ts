import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Contribution } from '../models/contribution.model';

@Injectable({
  providedIn: 'root'
})
export class ContributionService {
  constructor(private http: HttpClient) {}
  
  getContributionsByDataset(datasetId: string): Observable<Contribution[]> {
    return this.http.get<Contribution[]>(`/api/datasets/${datasetId}/contributions`);
  }
  
  getContributionById(id: string): Observable<Contribution> {
    return this.http.get<Contribution>(`/api/contributions/${id}`);
  }
  
  createContribution(contribution: Partial<Contribution>): Observable<Contribution> {
    return this.http.post<Contribution>('/api/contributions', contribution);
  }
  
  validateContribution(id: string, status: 'approved' | 'rejected', comment?: string): Observable<Contribution> {
    return this.http.post<Contribution>(`/api/contributions/${id}/validate`, { status, comment });
  }
}
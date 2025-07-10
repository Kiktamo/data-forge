import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

// Admin-specific interfaces
export interface AdminStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    newUsersThisWeek: number;
    totalDatasets: number;
    totalContributions: number;
    validatedContributions: number;
    pendingValidations: number;
    rejectedContributions: number;
  };
  growth: {
    usersGrowthRate: number;
    datasetsGrowthRate: number;
    contributionsGrowthRate: number;
  };
  quality: {
    averageValidationTime: number;
    averageQualityScore: number;
    topValidators: Array<{
      id: number;
      username: string;
      fullName?: string;
      validationCount: number;
      averageConfidence: number;
    }>;
  };
}

export interface SystemHealth {
  database: {
    status: 'healthy' | 'warning' | 'error';
    responseTime: number;
    connections: number;
  };
  embeddings: {
    status: 'healthy' | 'warning' | 'error';
    coverage: number;
    processingQueue: number;
  };
  storage: {
    status: 'healthy' | 'warning' | 'error';
    usedSpace: number;
    totalSpace: number;
  };
}

export interface UserManagementData {
  users: Array<{
    id: number;
    username: string;
    email: string;
    fullName?: string;
    roles: string[];
    isActive: boolean;
    emailVerified: boolean;
    lastLogin?: Date;
    created_at: Date;
    contributionCount: number;
    validationCount: number;
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface ContentModerationData {
  flaggedContributions: Array<{
    id: number;
    reason: string;
    severity: 'low' | 'medium' | 'high';
    reportedBy: { username: string };
    contribution: any;
    created_at: Date;
  }>;
  duplicateReports: Array<{
    id: number;
    contribution1: any;
    contribution2: any;
    similarity: number;
    status: 'pending' | 'resolved' | 'dismissed';
  }>;
}

export interface AnalyticsReport {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    newUsers: number;
    newDatasets: number;
    newContributions: number;
    validationsCompleted: number;
    duplicatesDetected: number;
  };
  trends: {
    userGrowth: Array<{ date: Date; count: number }>;
    contributionGrowth: Array<{ date: Date; count: number }>;
    validationRate: Array<{ date: Date; rate: number }>;
  };
  topPerformers: {
    datasets: Array<{ id: number; name: string; contributionCount: number }>;
    contributors: Array<{ id: number; username: string; contributionCount: number }>;
    validators: Array<{ id: number; username: string; validationCount: number }>;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // === SYSTEM ANALYTICS ===

  /**
   * Get comprehensive system statistics
   */
  getSystemStats(): Observable<{ success: boolean; data: AdminStats }> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }

  /**
   * Get system health status
   */
  getSystemHealth(): Observable<{ success: boolean; data: SystemHealth }> {
    return this.http.get<any>(`${this.apiUrl}/health`);
  }

  /**
   * Get analytics report for a specific time period
   */
  getAnalyticsReport(startDate: Date, endDate: Date): Observable<{ success: boolean; data: AnalyticsReport }> {
    const params = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
    return this.http.get<any>(`${this.apiUrl}/analytics/report`, { params });
  }

  // === EMBEDDING MANAGEMENT ===

  /**
   * Get embedding system status
   */
  getEmbeddingStatus(): Observable<{ success: boolean; data: any }> {
    return this.http.get<any>(`${this.apiUrl}/embeddings/status`);
  }

  /**
   * Process embeddings for all contributions or specific dataset
   */
  processEmbeddings(datasetId?: number): Observable<{ success: boolean; data: any }> {
    const payload = datasetId ? { datasetId } : {};
    return this.http.post<any>(`${this.apiUrl}/embeddings/process`, payload);
  }

  /**
   * Clean up orphaned embeddings
   */
  cleanupEmbeddings(): Observable<{ success: boolean; data: { deletedCount: number } }> {
    return this.http.delete<any>(`${this.apiUrl}/embeddings/cleanup`);
  }

  /**
   * Regenerate embeddings for specific contributions
   */
  regenerateEmbeddings(contributionIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/embeddings/regenerate`, { contributionIds });
  }

  // === DUPLICATE DETECTION ===

  /**
   * Get duplicate detection report for a dataset
   */
  getDuplicateReport(datasetId: number, threshold = 0.85): Observable<any> {
    const params = { threshold: threshold.toString() };
    return this.http.get<any>(`${this.apiUrl}/datasets/${datasetId}/duplicates`, { params });
  }

  /**
   * Find duplicate pairs in a dataset
   */
  findDuplicatePairs(datasetId: number, options: {
    threshold?: number;
    includeValidated?: boolean;
    limit?: number;
  } = {}): Observable<{ success: boolean; data: any }> {
    const params = {
      threshold: (options.threshold || 0.85).toString(),
      includeValidated: (options.includeValidated || false).toString(),
      limit: (options.limit || 50).toString()
    };
    return this.http.get<any>(`${this.apiUrl}/datasets/${datasetId}/duplicate-pairs`, { params });
  }

  /**
   * Mark contributions as duplicates
   */
  markAsDuplicates(contribution1Id: number, contribution2Id: number, action: 'merge' | 'remove'): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/duplicates/mark`, {
      contribution1Id,
      contribution2Id,
      action
    });
  }

  // === USER MANAGEMENT ===

  /**
   * Get users with admin management data
   */
  getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: 'active' | 'inactive' | 'all';
  } = {}): Observable<{ success: boolean; data: UserManagementData }> {
    return this.http.get<any>(`${this.apiUrl}/users`, { params: params as any });
  }

  /**
   * Update user roles
   */
  updateUserRoles(userId: number, roles: string[]): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/${userId}/roles`, { roles });
  }

  /**
   * Activate/deactivate user
   */
  updateUserStatus(userId: number, isActive: boolean): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/${userId}/status`, { isActive });
  }

  /**
   * Get user activity details
   */
  getUserActivity(userId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/${userId}/activity`);
  }

  // === CONTENT MODERATION ===

  /**
   * Get flagged content for moderation
   */
  getFlaggedContent(): Observable<{ success: boolean; data: ContentModerationData }> {
    return this.http.get<any>(`${this.apiUrl}/moderation/flagged`);
  }

  /**
   * Resolve content flag
   */
  resolveContentFlag(flagId: number, action: 'approve' | 'remove' | 'warn', notes?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/moderation/flags/${flagId}/resolve`, {
      action,
      notes
    });
  }

  /**
   * Bulk moderate contributions
   */
  bulkModerate(contributionIds: number[], action: 'approve' | 'reject', notes?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/moderation/bulk`, {
      contributionIds,
      action,
      notes
    });
  }

  // === DATASET MANAGEMENT ===

  /**
   * Get dataset quality analysis
   */
  getDatasetQualityAnalysis(datasetId?: number): Observable<any> {
    const url = datasetId 
      ? `${this.apiUrl}/datasets/${datasetId}/quality`
      : `${this.apiUrl}/datasets/quality-overview`;
    return this.http.get<any>(url);
  }

  /**
   * Archive/restore dataset
   */
  updateDatasetStatus(datasetId: number, isActive: boolean): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/datasets/${datasetId}/status`, { isActive });
  }

  /**
   * Force dataset reprocessing (embeddings, stats, etc.)
   */
  reprocessDataset(datasetId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/datasets/${datasetId}/reprocess`, {});
  }

  // === SYSTEM CONFIGURATION ===

  /**
   * Get system configuration
   */
  getSystemConfig(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/config`);
  }

  /**
   * Update system configuration
   */
  updateSystemConfig(config: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/config`, config);
  }

  /**
   * Get audit logs
   */
  getAuditLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Observable<any> {
    const processedParams: any = { ...params };
    if (params.startDate) {
      processedParams.startDate = params.startDate.toISOString();
    }
    if (params.endDate) {
      processedParams.endDate = params.endDate.toISOString();
    }

    return this.http.get<any>(`${this.apiUrl}/audit-logs`, { params: processedParams });
  }

  // === EXPORT & REPORTING ===

  /**
   * Export system data
   */
  exportData(type: 'users' | 'datasets' | 'contributions' | 'all', format: 'csv' | 'json' = 'csv'): Observable<Blob> {
    const params = { type, format };
    return this.http.get(`${this.apiUrl}/export`, {
      params,
      responseType: 'blob'
    });
  }

  /**
   * Generate custom report
   */
  generateReport(reportConfig: {
    type: string;
    parameters: any;
    format: 'pdf' | 'csv' | 'json';
  }): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/reports/generate`, reportConfig, {
      responseType: 'blob'
    });
  }

  // === REAL-TIME MONITORING ===

  /**
   * Get real-time system metrics
   */
  getRealTimeMetrics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/metrics/realtime`);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/metrics/performance`, {
      params: { timeRange }
    });
  }

  // === NOTIFICATION MANAGEMENT ===

  /**
   * Send system-wide notification
   */
  sendSystemNotification(notification: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    targetUsers?: number[];
    targetRoles?: string[];
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/notifications/send`, notification);
  }

  /**
   * Get notification history
   */
  getNotificationHistory(params: {
    page?: number;
    limit?: number;
  } = {}): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/notifications/history`, { params: params as any });
  }
}
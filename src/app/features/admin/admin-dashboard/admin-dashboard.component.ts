import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin, Observable, catchError } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';

import { AuthService } from '../../../core/services/auth.service';
import { DatasetService } from '../../../core/services/dataset.service';
import { ContributionService } from '../../../core/services/contribution.service';
import { AdminService } from '../../../core/services/admin.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environments';

interface SystemStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalDatasets: number;
    totalContributions: number;
    validatedContributions: number;
    pendingValidations: number;
    rejectedContributions: number;
  };
  datasetBreakdown: {
    public: number;
    private: number;
    collaborative: number;
  };
  dataTypeDistribution: {
    image: number;
    text: number;
    structured: number;
  };
  recentActivity: {
    datasets: any[];
    contributions: any[];
    validations: any[];
  };
}

interface EmbeddingStatus {
  overview: {
    totalContributions: number;
    embeddedContributions: number;
    coveragePercentage: number;
    pendingEmbeddings: number;
  };
  datasetBreakdown: Array<{
    dataset_id: number;
    dataset_name: string;
    total_contributions: number;
    embedded_contributions: number;
    coverage_percentage: number;
  }>;
}

interface DuplicateReport {
  datasetId: number;
  duplicatePairs: Array<{
    contribution1: any;
    contribution2: any;
    similarity: number;
  }>;
  threshold: number;
}

interface QualityMetrics {
  overallQuality: {
    averageQualityScore: number;
    validationRate: number;
    averageValidationTime: number;
    topValidators: Array<{
      validator: { username: string; fullName?: string };
      validationCount: number;
      averageConfidence: number;
    }>;
  };
  datasetQuality: Array<{
    dataset: { id: number; name: string };
    qualityScore: number;
    validationRate: number;
    contributionCount: number;
    duplicateRate: number;
  }>;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    MatExpansionModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private apiUrl = `${environment.apiUrl}`;

  // Loading states
  isLoadingStats = true;
  isLoadingEmbeddings = false;
  isLoadingQuality = false;
  isProcessingEmbeddings = false;

  // Data
  systemStats: SystemStats | null = null;
  embeddingStatus: EmbeddingStatus | null = null;
  qualityMetrics: QualityMetrics | null = null;
  duplicateReports: Map<number, DuplicateReport> = new Map();

  // UI State
  selectedDatasetForDuplicates: number | null = null;
  duplicateThreshold = 0.85;
  lastSearchedDataset: number | null = null;
  lastSearchedThreshold = 0.85;

  // Table configurations
  userColumns = ['username', 'email', 'created_at', 'role', 'contributions', 'actions'];
  datasetColumns = ['name', 'owner', 'created_at', 'type', 'visibility', 'contributions', 'quality', 'actions'];
  contributionColumns = ['id', 'dataset', 'contributor', 'type', 'status', 'created_at', 'duplicates', 'actions'];
  embeddingColumns = ['dataset_name', 'total_contributions', 'embedded_contributions', 'coverage_percentage', 'actions'];

  constructor(
    public authService: AuthService,
    private datasetService: DatasetService,
    private contributionService: ContributionService,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private adminService: AdminService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.hasRole('admin')) {
      return;
    }

    this.loadSystemStats();
    this.loadEmbeddingStatus();
    this.loadQualityMetrics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // === DATA LOADING METHODS ===

  loadSystemStats(): void {
    this.isLoadingStats = true;

    // Get basic user count from backend - I'll need to add this endpoint
    // For now, combine with existing dataset and contribution calls
    forkJoin({
      datasets: this.datasetService.getDatasets({ limit: 1000 }), // Get all datasets for analysis
      recentDatasets: this.datasetService.getDatasets({ limit: 10, sortBy: 'created_at', sortOrder: 'DESC' }),
      recentContributions: this.contributionService.getPendingContributions({ limit: 10, sortBy: 'created_at', sortOrder: 'DESC' }),
      // Try to get user stats if available, otherwise use fallback
      userStats: this.getUserStats()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responses) => {
        const datasets = responses.datasets.data.datasets;
        
        // Calculate dataset breakdowns
        const datasetBreakdown = {
          public: datasets.filter(d => d.visibility === 'public').length,
          private: datasets.filter(d => d.visibility === 'private').length,
          collaborative: datasets.filter(d => d.visibility === 'collaborative').length
        };

        const dataTypeDistribution = {
          image: datasets.filter(d => d.dataType === 'image').length,
          text: datasets.filter(d => d.dataType === 'text').length,
          structured: datasets.filter(d => d.dataType === 'structured').length
        };

        // Calculate contribution totals
        const totalContributions = datasets.reduce((sum, d) => sum + (d.contributionCount || 0), 0);
        const validatedContributions = datasets.reduce((sum, d) => sum + (d.validationCount || 0), 0);

        // Calculate unique users from dataset owners and recent contributions
        const uniqueOwners = new Set(datasets.map(d => d.owner?.id).filter(id => id));
        const uniqueContributors = new Set(responses.recentContributions.data.contributions.map(c => c.contributor?.id).filter(id => id));
        const allUniqueUsers = new Set([...uniqueOwners, ...uniqueContributors]);

        this.systemStats = {
          overview: {
            totalUsers: responses.userStats?.totalUsers || allUniqueUsers.size,
            activeUsers: responses.userStats?.activeUsers || Math.floor(allUniqueUsers.size * 0.7), // Estimate
            totalDatasets: datasets.length,
            totalContributions,
            validatedContributions,
            pendingValidations: totalContributions - validatedContributions,
            rejectedContributions: responses.userStats?.rejectedContributions || 0
          },
          datasetBreakdown,
          dataTypeDistribution,
          recentActivity: {
            datasets: responses.recentDatasets.data.datasets.slice(0, 5),
            contributions: responses.recentContributions.data.contributions.slice(0, 5),
            validations: [] // Would need separate API call
          }
        };

        this.isLoadingStats = false;
      },
      error: (error) => {
        console.error('Error loading system stats:', error);
        this.snackBar.open('Failed to load system statistics', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.isLoadingStats = false;
      }
    });
  }

  // Helper method to get user stats - will fallback gracefully if endpoint doesn't exist
  private getUserStats(): Observable<any> {
    // Try to get user stats from a dedicated endpoint, fallback if not available
    return this.http.get<any>(`${this.apiUrl}/admin/users/stats`).pipe(
      catchError(error => {
        console.log('User stats endpoint not available, using fallback');
        return new Observable(observer => {
          observer.next({ totalUsers: null, activeUsers: null });
          observer.complete();
        });
      })
    );
  }

  loadEmbeddingStatus(): void {
    this.isLoadingEmbeddings = true;

    this.adminService.getEmbeddingStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.embeddingStatus = response.data;
          }
          this.isLoadingEmbeddings = false;
        },
        error: (error) => {
          console.error('Error loading embedding status:', error);
          this.snackBar.open('Failed to load embedding status', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.isLoadingEmbeddings = false;
        }
      });
  }

  loadQualityMetrics(): void {
    this.isLoadingQuality = true;

    // This would be a custom endpoint that aggregates quality data
    // For now, I'll derive it from existing dataset data
    this.datasetService.getDatasets({ limit: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const datasets = response.data.datasets;
          
          // Calculate quality metrics from dataset data
          const totalContributions = datasets.reduce((sum, d) => sum + (d.contributionCount || 0), 0);
          const totalValidated = datasets.reduce((sum, d) => sum + (d.validationCount || 0), 0);
          const validationRate = totalContributions > 0 ? (totalValidated / totalContributions) * 100 : 0;

          const datasetQuality = datasets.map(dataset => ({
            dataset: { id: dataset.id, name: dataset.name },
            qualityScore: dataset.validationCount && dataset.contributionCount 
              ? (dataset.validationCount / dataset.contributionCount) * 100 
              : 0,
            validationRate: dataset.contributionCount > 0 
              ? (dataset.validationCount / dataset.contributionCount) * 100 
              : 0,
            contributionCount: dataset.contributionCount || 0,
            duplicateRate: 0 // Would need duplicate detection analysis
          })).sort((a, b) => b.qualityScore - a.qualityScore);

          this.qualityMetrics = {
            overallQuality: {
              averageQualityScore: validationRate,
              validationRate,
              averageValidationTime: 120, // Placeholder - would come from validation data
              topValidators: [] // Would need validation data with validator info
            },
            datasetQuality: datasetQuality.slice(0, 10) // Top 10 datasets
          };

          this.isLoadingQuality = false;
        },
        error: (error) => {
          console.error('Error loading quality metrics:', error);
          this.snackBar.open('Failed to load quality metrics', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.isLoadingQuality = false;
        }
      });
  }

  // === ADMIN ACTIONS ===

  processEmbeddings(datasetId?: number): void {
    this.isProcessingEmbeddings = true;

    this.adminService.processEmbeddings(datasetId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('Embedding processing completed successfully', 'Close', {
              duration: 5000,
              panelClass: ['success-snackbar']
            });
            this.loadEmbeddingStatus(); // Refresh status
          }
          this.isProcessingEmbeddings = false;
        },
        error: (error) => {
          console.error('Error processing embeddings:', error);
          this.snackBar.open('Failed to process embeddings', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.isProcessingEmbeddings = false;
        }
      });
  }

  loadDuplicateReport(datasetId: number): void {
    // Clear previous results if searching a different dataset or threshold
    if (this.lastSearchedDataset !== datasetId || this.lastSearchedThreshold !== this.duplicateThreshold) {
      this.duplicateReports.clear();
      this.lastSearchedDataset = datasetId;
      this.lastSearchedThreshold = this.duplicateThreshold;
    }

    this.adminService.findDuplicatePairs(datasetId, {
      threshold: this.duplicateThreshold,
      includeValidated: false,
      limit: 50
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.duplicateReports.set(datasetId, response.data);
          this.snackBar.open(`Found ${response.data.duplicatePairs.length} potential duplicate pairs`, 'Close', {
            duration: 3000,
            panelClass: ['info-snackbar']
          });
        }
      },
      error: (error) => {
        console.error('Error loading duplicate report:', error);
        this.snackBar.open('Failed to load duplicate report', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  cleanupEmbeddings(): void {
    this.adminService.cleanupEmbeddings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open(`Cleaned up ${response.data.deletedCount} orphaned embeddings`, 'Close', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            this.loadEmbeddingStatus(); // Refresh status
          }
        },
        error: (error) => {
          console.error('Error cleaning up embeddings:', error);
          this.snackBar.open('Failed to cleanup embeddings', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
  }

  // === UTILITY METHODS ===

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved':
        return 'status-approved';
      case 'rejected':
        return 'status-rejected';
      case 'pending':
        return 'status-pending';
      case 'admin':
      case 'moderator':
        return 'status-admin';
      case 'contributor':
        return 'status-contributor';
      case 'viewer':
      default:
        return 'status-viewer';
    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'image':
        return 'image';
      case 'text':
        return 'text_fields';
      case 'structured':
        return 'table_chart';
      default:
        return 'dataset';
    }
  }

  getVisibilityIcon(visibility: string): string {
    switch (visibility) {
      case 'public':
        return 'public';
      case 'private':
        return 'lock';
      case 'collaborative':
        return 'group';
      default:
        return 'help';
    }
  }

  getCoverageColor(percentage: number): string {
    if (percentage >= 80) return 'primary';
    if (percentage >= 50) return 'accent';
    return 'warn';
  }

  getQualityScoreColor(score: number): string {
    if (score >= 80) return 'primary';
    if (score >= 60) return 'accent';
    return 'warn';
  }

  formatPercentage(value: number): string {
    return `${Math.round(value)}%`;
  }

  // Helper method to get current threshold display
  getCurrentThresholdDisplay(): string {
    return `${(this.duplicateThreshold * 100)}%`;
  }

  // Helper method to check if results are outdated
  areResultsOutdated(datasetId: number): boolean {
    return this.lastSearchedDataset !== datasetId || this.lastSearchedThreshold !== this.duplicateThreshold;
  }

  // === NAVIGATION METHODS ===

  viewDataset(datasetId: number): void {
    this.router.navigate(['/datasets', datasetId]);
  }

  viewContribution(contributionId: number): void {
    this.router.navigate(['/contributions', contributionId]);
  }

  manageUser(userId: number): void {
    // User management functionality. Not yet implemented.
    console.log('Manage user:', userId);
    // this.router.navigate(['/admin/users', userId]);
  }
}

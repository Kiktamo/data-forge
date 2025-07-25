import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

import { Dataset } from '../../../core/models/dataset.model';
import { DatasetService } from '../../../core/services/dataset.service';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/web-socket.service';
import { PresenceIndicatorComponent } from '../../../core/components/presence-indicator/presence-indicator.component';
import { Contribution } from '../../../core/models/contribution.model';
import { ContributionService } from '../../../core/services/contribution.service';
import { ExportDialogComponent } from '../../../core/components/export-dialog/export-dialog.component';
import { DatasetAnalyticsComponent } from '../dataset-analytics/dataset-analytics.component';
import { DatasetActivityTimelineComponent } from '../dataset-activity-timeline/dataset-activity-timeline.component';


interface DatasetStats {
  totalContributions: number;
  validatedContributions: number;
  pendingValidations: number;
  currentVersion: string;
  created_at: Date;
  lastUpdated: Date;
  tags: string[];
  dataType: string;
}

interface DatasetHistoryItem {
  id: number;
  version: Date;
  isHistorical: boolean;
  name: string;
  description?: string;
  contributionCount: number;
  validationCount: number;
  created_at: Date;
  updated_at: Date;
}

@Component({
  selector: 'app-dataset-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressBarModule,
    MatBadgeModule,
    PresenceIndicatorComponent,
    MatPaginatorModule,
    MatSelectModule,
    MatFormFieldModule,
    DatasetAnalyticsComponent,
    DatasetActivityTimelineComponent
  ],
  templateUrl: './dataset-detail.component.html',
  styleUrls: ['./dataset-detail.component.scss']
})
export class DatasetDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private datasetId!: number;
  
  // Main data
  dataset: Dataset | null = null;
  stats: DatasetStats | null = null;
  history: DatasetHistoryItem[] = [];
  
  // Loading states
  isLoading = true;
  isLoadingStats = false;
  isLoadingHistory = false;
  isDeletingDataset = false;
  
  // UI state
  selectedTabIndex = 0;
  historyPage = 1;
  historyPageSize = 10;
  historyTotalItems = 0;

  // NEW: Contributions data
  contributions: Contribution[] = [];
  contributionsPage = 1;
  contributionsPageSize = 12;
  contributionsTotalItems = 0;
  isLoadingContributions = false;
  contributionsFilter: 'pending' | 'approved' | 'rejected' = 'pending';
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private datasetService: DatasetService,
    public authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private wsService: WebSocketService,
    private contributionService: ContributionService
  ) {}
  
  ngOnInit(): void {
    // Get dataset ID from route
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || isNaN(Number(id))) {
      this.router.navigate(['/datasets']);
      return;
    }
    
    this.datasetId = Number(id);
    this.loadDataset();
  }
  
  ngOnDestroy(): void {
    // Leave dataset before destroying component
    this.wsService.leaveDataset();
    
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Load main dataset information
  loadDataset(): void {
    this.isLoading = true;
    
    this.datasetService.getDatasetById(this.datasetId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (dataset) => {
        this.dataset = dataset;
        this.isLoading = false;
        
        // Join dataset room for real-time updates
        this.wsService.joinDataset(dataset.id);
        
        // Load additional data
        this.loadStats();
      },
      error: (error) => {
        console.error('Error loading dataset:', error);
        this.isLoading = false;
        
        if (error.status === 404) {
          this.snackBar.open('Dataset not found', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.router.navigate(['/datasets']);
        } else if (error.status === 403) {
          this.snackBar.open('Access denied to this dataset', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.router.navigate(['/datasets']);
        } else {
          this.snackBar.open('Failed to load dataset details', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      }
    });
  }
  
  // Load dataset statistics
  loadStats(): void {
    if (!this.dataset) return;
    
    this.isLoadingStats = true;
    this.datasetService.getDatasetStats(this.dataset.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.isLoadingStats = false;
      },
      error: (error) => {
        console.error('Error loading dataset stats:', error);
        this.isLoadingStats = false;
      }
    });
  }
  
  // Load dataset history/versions
  loadHistory(page: number = 1): void {
    if (!this.dataset) return;
    
    this.isLoadingHistory = true;
    this.datasetService.getDatasetHistory(this.dataset.id, {
      page,
      limit: this.historyPageSize,
      sortOrder: 'DESC'
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.history = response.data.history;
        this.historyPage = response.data.pagination.currentPage;
        this.historyTotalItems = response.data.pagination.totalItems;
        this.isLoadingHistory = false;
      },
      error: (error) => {
        console.error('Error loading dataset history:', error);
        this.isLoadingHistory = false;
        this.snackBar.open('Failed to load version history', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }
  
  // Handle tab change
  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    
    // Load history when history tab is selected
    if (index === 2 && this.history.length === 0) {
      this.loadHistory();
    }
    
    // NEW: Load contributions when contributions tab is selected
    if (index === 3 && this.contributions.length === 0) {
      this.loadContributions();
    }
  }
  
  // Permission checks
  canEditDataset(): boolean {
    return !!(this.dataset && this.authService.currentUser && 
             (Number(this.authService.currentUser.id) === this.dataset.ownerId || 
              this.authService.hasRole('admin')));
  }
  
  canDeleteDataset(): boolean {
    return this.canEditDataset();
  }
  
  canContributeToDataset(): boolean {
    if (!this.dataset) return false;
    
    // Public and collaborative datasets allow contributions
    if (this.dataset.visibility === 'public' || this.dataset.visibility === 'collaborative') {
      return true;
    }
    
    // Private datasets only allow owner contributions
    return this.canEditDataset();
  }
  
  // Get display values
  getDataTypeIcon(): string {
    if (!this.dataset) return 'dataset';
    
    switch (this.dataset.dataType) {
      case 'image': return 'image';
      case 'text': return 'text_fields';
      case 'structured': return 'table_chart';
      default: return 'dataset';
    }
  }
  
  getDataTypeLabel(): string {
    if (!this.dataset) return 'Unknown';
    
    switch (this.dataset.dataType) {
      case 'image': return 'Image Data';
      case 'text': return 'Text Data';
      case 'structured': return 'Structured Data';
      default: return 'Unknown';
    }
  }
  
  getVisibilityIcon(): string {
    if (!this.dataset) return 'help';
    
    switch (this.dataset.visibility) {
      case 'public': return 'public';
      case 'private': return 'lock';
      case 'collaborative': return 'group';
      default: return 'help';
    }
  }
  
  getVisibilityLabel(): string {
    if (!this.dataset) return 'Unknown';
    
    switch (this.dataset.visibility) {
      case 'public': return 'Public';
      case 'private': return 'Private';
      case 'collaborative': return 'Collaborative';
      default: return 'Unknown';
    }
  }
  
  getOwnerDisplayName(): string {
    if (!this.dataset || !this.dataset.owner) return 'Unknown User';
    
    return this.dataset.owner.fullName || this.dataset.owner.username || 'Unknown User';
  }
  
  // Calculate completion percentage
  getCompletionPercentage(): number {
    if (!this.stats || this.stats.totalContributions === 0) return 0;
    return Math.round((this.stats.validatedContributions / this.stats.totalContributions) * 100);
  }
  
  // Actions
  editDataset(): void {
    if (this.dataset) {
      this.router.navigate(['/datasets', this.dataset.id, 'edit']);
    }
  }
  
  contributeToDataset(): void {
    if (this.dataset) {
      this.router.navigate(['/datasets', this.dataset.id, 'contribute']);
    }
  }
  
  deleteDataset(): void {
    if (!this.dataset || !this.canDeleteDataset()) return;
    
    const confirmMessage = `Are you sure you want to delete "${this.dataset.name}"? This action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      this.isDeletingDataset = true;
      
      this.datasetService.deleteDataset(this.dataset.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.snackBar.open('Dataset deleted successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.router.navigate(['/datasets']);
        },
        error: (error) => {
          console.error('Error deleting dataset:', error);
          this.isDeletingDataset = false;
          this.snackBar.open('Failed to delete dataset', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }
  
  createNewVersion(): void {
    if (!this.dataset) return;
    
    // For now, just create a patch version
    // In a full implementation, you might want a dialog to choose version type
    this.datasetService.createDatasetVersion(this.dataset.id, {
      incrementType: 'patch',
      versionDescription: 'Manual version creation'
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.snackBar.open(`Version ${response.newVersion} created successfully`, 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        // Reload dataset and history
        this.loadDataset();
        this.loadHistory();
      },
      error: (error) => {
        console.error('Error creating version:', error);
        this.snackBar.open('Failed to create new version', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }
  
  shareDataset(): void {
    if (!this.dataset) return;
    
    const url = `${window.location.origin}/datasets/${this.dataset.id}`;
    
    if (navigator.share) {
      navigator.share({
        title: this.dataset.name,
        text: this.dataset.description || 'Check out this dataset',
        url: url
      }).catch(err => console.log('Error sharing:', err));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url).then(() => {
        this.snackBar.open('Dataset URL copied to clipboard', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      }).catch(() => {
        this.snackBar.open('Could not copy URL to clipboard', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      });
    }
  }
  
downloadDataset(): void {
  if (!this.dataset) return;

  const dialogRef = this.dialog.open(ExportDialogComponent, {
    width: '600px',
    maxWidth: '90vw',
    data: {
      dataset: this.dataset,
      isOwner: this.canEditDataset()
    },
    disableClose: false
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      // Export was successful
      console.log('Dataset export completed');
    }
  });
}

   // Load contributions for this dataset
  loadContributions(page: number = 1): void {
    if (!this.dataset) return;
    
    this.isLoadingContributions = true;
    
    const params: any = {
      page,
      limit: this.contributionsPageSize,
      sortBy: 'created_at',
      sortOrder: 'DESC' as const
    };
    
    // Only add status if it's not empty
    if (this.contributionsFilter) {
      params.status = this.contributionsFilter;
    }
    
    this.contributionService.getContributionsByDataset(this.dataset.id, params).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.contributions = response.data.contributions;
        this.contributionsPage = response.data.pagination.currentPage;
        this.contributionsTotalItems = response.data.pagination.totalItems;
        this.isLoadingContributions = false;
      },
      error: (error) => {
        console.error('Error loading contributions:', error);
        this.isLoadingContributions = false;
        this.snackBar.open('Failed to load contributions', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  // Handle contributions filter change
  onContributionsFilterChange(): void {
    this.contributionsPage = 1;
    this.loadContributions();
  }

  // Handle contributions page change
  onContributionsPageChange(event: any): void {
    this.contributionsPage = event.pageIndex + 1;
    this.contributionsPageSize = event.pageSize;
    this.loadContributions(this.contributionsPage);
  }

  // Get contribution preview URL
  getContributionPreviewUrl(contribution: any): string {
    return this.contributionService.getContributionFileUrl(contribution) || '';
  }

  // Get contribution icon
  getContributionIcon(dataType: string): string {
    switch (dataType) {
      case 'image': return 'image';
      case 'text': return 'text_fields';
      case 'structured': return 'table_chart';
      default: return 'dataset';
    }
  }

  // Get status label for contributions
  getContributionStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  }

    // Handle image error
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://placehold.co/300x200?text=Image+Not+Found';
  }
  
}
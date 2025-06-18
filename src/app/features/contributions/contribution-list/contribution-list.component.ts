import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { Contribution } from '../../../core/models/contribution.model';
import { ContributionService, ContributionQueryParams } from '../../../core/services/contribution.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-contribution-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTooltipModule,
    MatBadgeModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './contribution-list.component.html',
  styleUrls: ['./contribution-list.component.scss']
})
export class ContributionListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data properties
  contributions: Contribution[] = [];
  isLoading = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 12;
  pageSizeOptions = [6, 12, 24, 48];
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  hasPrev = false;
  
  // Filters
  selectedStatus = '';
  
  constructor(
    private contributionService: ContributionService,
    public authService: AuthService,
    private route: ActivatedRoute
  ) {}
  
  ngOnInit(): void {
    // Check if user is authenticated
    if (!this.authService.currentUser) {
      return;
    }
    
    this.loadContributions();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Load user's contributions
  loadContributions(): void {
    if (!this.authService.currentUser) return;
    
    this.isLoading = true;
    
    const params: ContributionQueryParams = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    };
    
    if (this.selectedStatus) {
      params.status = this.selectedStatus as any;
    }
    
    this.contributionService.getUserContributions(
      Number(this.authService.currentUser.id), 
      params
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        console.log('Contributions loaded:', response);
        this.contributions = response.data.contributions;
        this.currentPage = response.data.pagination.currentPage;
        this.totalItems = response.data.pagination.totalItems;
        this.totalPages = response.data.pagination.totalPages;
        this.hasNext = response.data.pagination.hasNext;
        this.hasPrev = response.data.pagination.hasPrev;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading contributions:', error);
        this.isLoading = false;
      }
    });
  }
  
  // Handle status filter change
  onStatusChange(): void {
    this.currentPage = 1;
    this.loadContributions();
  }
  
  // Handle page change
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadContributions();
  }
  
  // Utility methods
  getDataTypeIcon(dataType: string): string {
    switch (dataType) {
      case 'image': return 'image';
      case 'text': return 'text_fields';
      case 'structured': return 'table_chart';
      default: return 'dataset';
    }
  }
  
  getDataTypeLabel(dataType: string): string {
    switch (dataType) {
      case 'image': return 'Image';
      case 'text': return 'Text';
      case 'structured': return 'Structured';
      default: return 'Unknown';
    }
  }
  
  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  }
  
  getImagePreviewUrl(contribution: Contribution): string {
    return this.contributionService.getContributionFileUrl(contribution) || '/assets/images/placeholder.png';
  }
  
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://placehold.co/400';
  }
}
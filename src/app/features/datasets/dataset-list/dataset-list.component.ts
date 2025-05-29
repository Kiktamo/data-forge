import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

import { Dataset, DatasetQueryParams } from '../../../core/models/dataset.model';
import { DatasetService } from '../../../core/services/dataset.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-dataset-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatSnackBarModule
  ],
  templateUrl: './dataset-list.component.html',
  styleUrls: ['./dataset-list.component.scss']
})
export class DatasetListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  // Data properties
  datasets: Dataset[] = [];
  isLoading = false;
  isMyDatasetsMode = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 9;
  pageSizeOptions = [3, 6, 9, 12, 24];
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  hasPrev = false;
  
  // Filters
  searchQuery = '';
  selectedDataType: '' | 'image' | 'text' | 'structured' = '';
  selectedSortBy = 'updatedAt-DESC';
  selectedSortOrder = 'DESC';
  selectedVisibility: '' | 'public' | 'private' | 'collaborative' = '';
  
  // Filter options
  dataTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'image', label: 'Images' },
    { value: 'text', label: 'Text' },
    { value: 'structured', label: 'Structured Data' }
  ];
  
  sortOptions = [
    { value: 'updatedAt-DESC', label: 'Recently Updated' },
    { value: 'createdAt-DESC', label: 'Newest First' },
    { value: 'createdAt-ASC', label: 'Oldest First' },
    { value: 'name-ASC', label: 'Name (A-Z)' },
    { value: 'name-DESC', label: 'Name (Z-A)' },
    { value: 'contributionCount-DESC', label: 'Most Contributions' }
  ];

  visibilityOptions = [
    { value: '', label: 'All Visibility' },
    { value: 'public', label: 'Public' },
    { value: 'collaborative', label: 'Collaborative' }
  ];
  
  constructor(
    private datasetService: DatasetService,
    public authService: AuthService,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute
  ) {}
  
  ngOnInit(): void {
    // Check if we're in "my datasets" mode
    this.isMyDatasetsMode = this.route.snapshot.data['myDatasets'] === true;
    
    // Set up search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchQuery = searchTerm;
      this.currentPage = 1; // Reset to first page when searching
      this.loadDatasets();
    });
    
    // Load initial datasets
    this.loadDatasets();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Load datasets from the API
  loadDatasets(): void {
    this.isLoading = true;
    
    const [sortBy, sortOrder] = this.selectedSortBy.includes('-') 
      ? this.selectedSortBy.split('-') as [string, 'ASC' | 'DESC']
      : [this.selectedSortBy, this.selectedSortOrder as 'ASC' | 'DESC'];
    
    const params: DatasetQueryParams = {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchQuery || undefined,
      dataType: (this.selectedDataType as any) || undefined,
      visibility: (this.selectedVisibility as any) || undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder
    };
    
    // If in "my datasets" mode, get user's datasets
    const request$ = this.isMyDatasetsMode && this.authService.currentUser
      ? this.datasetService.getUserDatasets(Number(this.authService.currentUser.id), params)
      : this.datasetService.getDatasets(params);
    
    request$.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.datasets = response.data.datasets;
        this.currentPage = response.data.pagination.currentPage;
        this.totalItems = response.data.pagination.totalItems;
        this.totalPages = response.data.pagination.totalPages;
        this.hasNext = response.data.pagination.hasNext;
        this.hasPrev = response.data.pagination.hasPrev;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading datasets:', error);
        this.snackBar.open('Failed to load datasets. Please try again.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.isLoading = false;
      }
    });
  }
  
  // Handle search input
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }
  
  // Clear search
  clearSearch(): void {
    this.searchQuery = '';
    this.searchSubject.next('');
  }
  
  // Apply filters
  applyFilters(): void {
    this.currentPage = 1; // Reset to first page when filters change
    this.loadDatasets();
  }
  
  // Handle page change
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1; // Angular Material paginator is 0-based
    this.pageSize = event.pageSize;
    this.loadDatasets();
  }
  
  // Reset all filters
  resetFilters(): void {
    this.searchQuery = '';
    this.selectedDataType = '';
    this.selectedSortBy = 'updatedAt-DESC';
    this.selectedSortOrder = 'DESC';
    this.selectedVisibility = '';
    this.currentPage = 1;
    this.loadDatasets();
  }
  
  // Check if filters are applied
  get hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.selectedDataType || this.selectedVisibility || 
             this.selectedSortBy !== 'updatedAt-DESC' || this.selectedSortOrder !== 'DESC');
  }
  
  // Get display name for dataset owner
  getOwnerDisplayName(dataset: Dataset): string {
    if (dataset.owner?.fullName) {
      return dataset.owner.fullName;
    }
    if (dataset.owner?.username) {
      return dataset.owner.username;
    }
    return 'Unknown User';
  }
  
  // Get icon for data type
  getDataTypeIcon(dataType: string): string {
    switch (dataType) {
      case 'image': return 'image';
      case 'text': return 'text_fields';
      case 'structured': return 'table_chart';
      default: return 'dataset';
    }
  }
  
  // Get icon for visibility
  getVisibilityIcon(visibility: string): string {
    switch (visibility) {
      case 'public': return 'public';
      case 'private': return 'lock';
      case 'collaborative': return 'group';
      default: return 'help';
    }
  }
  
  // Handle dataset deletion (for owned datasets)
  deleteDataset(dataset: Dataset, event: Event): void {
    event.stopPropagation();
    
    if (!this.authService.currentUser || Number(this.authService.currentUser.id) !== dataset.ownerId) {
      this.snackBar.open('You can only delete your own datasets.', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }
    
    if (confirm(`Are you sure you want to delete "${dataset.name}"? This action cannot be undone.`)) {
      this.datasetService.deleteDataset(dataset.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.snackBar.open('Dataset deleted successfully.', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.loadDatasets(); // Reload the list
        },
        error: (error) => {
          console.error('Error deleting dataset:', error);
          this.snackBar.open('Failed to delete dataset. Please try again.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }
  
  // Check if user can edit dataset
  canEditDataset(dataset: Dataset): boolean {
    return !!(this.authService.currentUser && 
             (Number(this.authService.currentUser.id) === dataset.ownerId || 
              this.authService.hasRole('admin')));
  }
  
  // Check if user can contribute to dataset
  canContributeToDataset(dataset: Dataset): boolean {
    return dataset.visibility !== 'private' || this.canEditDataset(dataset);
  }
}
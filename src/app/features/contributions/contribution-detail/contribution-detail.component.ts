import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';

import { Contribution } from '../../../core/models/contribution.model';
import { ContributionService } from '../../../core/services/contribution.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-contribution-detail',
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
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatTabsModule,
    MatExpansionModule
  ],
  templateUrl: './contribution-detail.component.html',
  styleUrl: './contribution-detail.component.scss'
})
export class ContributionDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private contributionId!: number;
  
  // Main data
  contribution: Contribution | null = null;
  
  // Loading states
  isLoading = true;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contributionService: ContributionService,
    public authService: AuthService,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit(): void {
    // Get contribution ID from route
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || isNaN(Number(id))) {
      this.router.navigate(['/contributions']);
      return;
    }
    
    this.contributionId = Number(id);
    this.loadContribution();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Load contribution details
  loadContribution(): void {
    this.isLoading = true;
    
    this.contributionService.getContributionById(this.contributionId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.contribution = response.data.contribution;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading contribution:', error);
        this.isLoading = false;
        
        if (error.status === 404) {
          this.snackBar.open('Contribution not found', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.router.navigate(['/contributions']);
        } else {
          this.snackBar.open('Failed to load contribution details', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      }
    });
  }
  
  // Permission checks
  canEditContribution(): boolean {
    return !!(this.contribution && this.authService.currentUser && 
             (Number(this.authService.currentUser.id) === this.contribution.contributorId || 
              this.authService.hasRole('admin')));
  }
  
  // Navigation
  goBack(): void {
    // Try to go back to previous page, fallback to contributions list
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/contributions']);
    }
  }
  
  // Get display values
  getDataTypeIcon(): string {
    if (!this.contribution) return 'dataset';
    
    switch (this.contribution.dataType) {
      case 'image': return 'image';
      case 'text': return 'text_fields';
      case 'structured': return 'table_chart';
      default: return 'dataset';
    }
  }
  
  getDataTypeLabel(): string {
    if (!this.contribution) return 'Unknown';
    
    switch (this.contribution.dataType) {
      case 'image': return 'Image';
      case 'text': return 'Text';
      case 'structured': return 'Structured Data';
      default: return 'Unknown';
    }
  }
  
  getStatusIcon(): string {
    if (!this.contribution) return 'help';
    
    switch (this.contribution.validationStatus) {
      case 'pending': return 'schedule';
      case 'approved': return 'check_circle';
      case 'rejected': return 'cancel';
      default: return 'help';
    }
  }
  
  getStatusLabel(): string {
    if (!this.contribution) return 'Unknown';
    
    switch (this.contribution.validationStatus) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  }
  
  getContributorName(): string {
    if (!this.contribution) return 'Unknown';
    
    if (this.contribution.contributor) {
      return this.contribution.contributor.fullName || 
             this.contribution.contributor.username || 
             'Unknown User';
    }
    
    return 'Unknown User';
  }
  
  getImageUrl(): string {
    if (!this.contribution) return '';
    return this.contributionService.getContributionFileUrl(this.contribution) || '';
  }
  
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Actions
  editContribution(): void {
    // Navigate to edit form (would need to be implemented)
    this.snackBar.open('Edit functionality coming soon', 'Close', {
      duration: 3000
    });
  }
  
  deleteContribution(): void {
    if (!this.contribution || !this.canEditContribution()) return;
    
    const confirmMessage = 'Are you sure you want to delete this contribution? This action cannot be undone.';
    
    if (confirm(confirmMessage)) {
      this.contributionService.deleteContribution(this.contribution.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.snackBar.open('Contribution deleted successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.router.navigate(['/contributions']);
        },
        error: (error) => {
          console.error('Error deleting contribution:', error);
          this.snackBar.open('Failed to delete contribution', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }
  
  downloadFile(): void {
    if (!this.contribution || !this.contribution.content?.file) return;
    
    const url = this.getImageUrl(); // This method works for all file types
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = this.contribution.content.file.originalName || 'file';
      link.click();
    }
  }
  
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://placehold.co/400x300?text=Image+Not+Found';
  }
}
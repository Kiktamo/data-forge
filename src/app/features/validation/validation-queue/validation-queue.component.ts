import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';

import { Contribution } from '../../../core/models/contribution.model';
import {
  ContributionService,
  ContributionQueryParams,
} from '../../../core/services/contribution.service';
import { AuthService } from '../../../core/services/auth.service';
import { DuplicateDialogComponent } from '../../../core/components/duplicate-dialog/duplicate-dialog.component';

interface ValidationCriteria {
  relevance: number;
  quality: number;
  accuracy: number;
  completeness: number;
  [key: string]: number;
}

@Component({
  selector: 'app-validation-queue',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
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
    MatSelectModule,
    MatInputModule,
    MatSliderModule,
    MatCheckboxModule,
    MatDialogModule,
    MatDividerModule,
    MatExpansionModule,
  ],
  templateUrl: './validation-queue.component.html',
  styleUrl: './validation-queue.component.scss',
})
export class ValidationQueueComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private validationStartTime: number = 0;

  // Data properties
  contributions: Contribution[] = [];
  isLoading = false;
  isSubmittingValidation = false;

  // Stats
  totalPending = 0;
  validatedToday = 0;

  // Pagination
  currentPage = 1;
  pageSize = 5; // Smaller page size for validation queue
  pageSizeOptions = [5, 10, 20];
  totalItems = 0;

  // Filters
  selectedDataType = '';
  selectedSortBy = 'created_at-ASC';

  // Validation form
  validationForm: FormGroup;
  expandedContribution: number | null = null;

  // Quality criteria for assessment
  qualityCriteria = [
    { key: 'relevance', label: 'Relevance to Dataset' },
    { key: 'quality', label: 'Overall Quality' },
    { key: 'accuracy', label: 'Accuracy/Correctness' },
    { key: 'completeness', label: 'Completeness' },
  ];

  constructor(
    private contributionService: ContributionService,
    public authService: AuthService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private dialog: MatDialog
  ) {
    this.validationForm = this.fb.group({
      status: ['', Validators.required],
      confidence: [
        0.8,
        [Validators.required, Validators.min(0.1), Validators.max(1.0)],
      ],
      notes: ['', [Validators.maxLength(2000)]],
      // Quality criteria (1-5 scale)
      criteria_relevance: [3],
      criteria_quality: [3],
      criteria_accuracy: [3],
      criteria_completeness: [3],
    });
  }

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    this.loadPendingContributions();
    this.loadValidationStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Form getter
  get notes() {
    return this.validationForm.get('notes');
  }

  // Load pending contributions for validation
  loadPendingContributions(): void {
    this.isLoading = true;

    const params: ContributionQueryParams = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.selectedSortBy.split('-')[0] as any,
      sortOrder: this.selectedSortBy.split('-')[1] as any,
    };

    if (this.selectedDataType) {
      params.dataType = this.selectedDataType as any;
    }

    this.contributionService
      .getPendingContributions(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.contributions = response.data.contributions;
          this.currentPage = response.data.pagination.currentPage;
          this.totalItems = response.data.pagination.totalItems;
          this.totalPending = response.data.pagination.totalItems;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading pending contributions:', error);
          this.snackBar.open('Failed to load pending contributions', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.isLoading = false;
        },
      });
  }

  // Load validation statistics
  loadValidationStats(): void {
    // This would be implemented with a dedicated stats endpoint
    // For now, we'll use placeholder values
    this.validatedToday = 0; // Would come from API
  }

  // Handle filters
  applyFilters(): void {
    this.currentPage = 1;
    this.loadPendingContributions();
  }

  // Handle page change
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadPendingContributions();
  }

  // Open validation form
  openValidationForm(contribution: Contribution): void {
    this.expandedContribution = contribution.id;
    this.validationStartTime = Date.now();

    // Reset form with defaults based on contribution type
    this.validationForm.reset({
      status: '',
      confidence: 0.8,
      notes: '',
      criteria_relevance: 3,
      criteria_quality: 3,
      criteria_accuracy: 3,
      criteria_completeness: 3,
    });
  }

  // Close validation form
  closeValidationForm(): void {
    this.expandedContribution = null;
    this.validationForm.reset();
  }

  // Submit detailed validation
  submitValidation(contribution: Contribution): void {
    if (this.validationForm.invalid) return;

    this.isSubmittingValidation = true;
    const formValue = this.validationForm.value;

    // Calculate time spent
    const timeSpent = Math.round(
      (Date.now() - this.validationStartTime) / 1000
    );

    // Build validation criteria object
    const validationCriteria: ValidationCriteria = {
      relevance: formValue.criteria_relevance,
      quality: formValue.criteria_quality,
      accuracy: formValue.criteria_accuracy,
      completeness: formValue.criteria_completeness,
    };

    const validationData = {
      status: formValue.status,
      confidence: formValue.confidence,
      notes: formValue.notes,
      validationCriteria,
      timeSpent,
    };

    this.contributionService
      .createValidation(contribution.id, validationData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.snackBar.open('Validation submitted successfully!', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar'],
          });

          // Remove contribution from list
          this.contributions = this.contributions.filter(
            (c) => c.id !== contribution.id
          );
          this.totalItems--;
          this.closeValidationForm();
          this.isSubmittingValidation = false;
          this.validatedToday++;
        },
        error: (error) => {
          console.error('Error submitting validation:', error);
          this.snackBar.open('Failed to submit validation', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.isSubmittingValidation = false;
        },
      });
  }

  // Quick validation (approve/reject without detailed form)
  quickValidation(
    contribution: Contribution,
    status: 'approved' | 'rejected'
  ): void {
    this.isSubmittingValidation = true;

    const validationData = {
      status,
      confidence: 0.7, // Default confidence for quick validation
      notes: status === 'approved' ? 'Quick approval' : 'Quick rejection',
      validationCriteria: {
        relevance: 3,
        quality: 3,
        accuracy: 3,
        completeness: 3,
      },
      timeSpent: 10, // Estimated quick validation time
    };

    this.contributionService
      .createValidation(contribution.id, validationData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.snackBar.open(`Contribution ${status}!`, 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar'],
          });

          // Remove contribution from list
          this.contributions = this.contributions.filter(
            (c) => c.id !== contribution.id
          );
          this.totalItems--;
          this.isSubmittingValidation = false;
          this.validatedToday++;
        },
        error: (error) => {
          console.error('Error submitting quick validation:', error);
          this.snackBar.open('Failed to submit validation', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.isSubmittingValidation = false;
        },
      });
  }

  // Utility methods
  getDataTypeIcon(dataType: string): string {
    switch (dataType) {
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

  getDataTypeLabel(dataType: string): string {
    switch (dataType) {
      case 'image':
        return 'Image';
      case 'text':
        return 'Text';
      case 'structured':
        return 'Structured';
      default:
        return 'Unknown';
    }
  }

  getImagePreviewUrl(contribution: Contribution): string {
    // Use the contribution service method for consistent URL generation
    const url = this.contributionService.getContributionFileUrl(contribution);
    if (url) {
      return url;
    }

    // Fallback to placeholder
    return 'https://placehold.co/400x300?text=Image+Preview';
  }

  viewSimilarContributions(contribution: Contribution): void {
    if (!contribution.duplicateDetection?.topSimilarities) {
      this.snackBar.open(
        'No detailed similarity information available',
        'Close',
        {
          duration: 3000,
        }
      );
      return;
    }

    // Convert the similarity data to the format expected by the dialog
    const duplicates = contribution.duplicateDetection.topSimilarities.map(
      (similarity) => ({
        contributionId: similarity.contributionId,
        similarity: similarity.similarity,
        contentExcerpt: similarity.contentExcerpt,
        contribution: {
          id: similarity.contributionId,
          // We don't have full contribution data, so provide minimal info
          created_at: new Date(), // Placeholder
          validationStatus: 'pending' as const, // Default assumption
          contributor: { username: 'Unknown', id: 0 },
          datasetId: contribution.datasetId,
          contributorId: 0,
          dataType: contribution.dataType,
          content: {},
          metadata: {},
          isActive: true,
          updated_at: new Date(),
        },
      })
    );

    const dialogRef = this.dialog.open(DuplicateDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      data: {
        type:
          contribution.duplicateDetection.highSimilarityCount > 0
            ? 'warning'
            : 'info',
        duplicates,
        title: 'Similar Contributions in Validation Queue',
        message: `This contribution has ${duplicates.length} similar contribution(s). Consider this when making your validation decision.`,
      },
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.action === 'view' && result.contributionId) {
        // Could navigate to the specific contribution or handle as needed
        this.snackBar.open(
          `Viewing contribution ${result.contributionId}`,
          'Close',
          {
            duration: 3000,
          }
        );
      }
    });
  }

  // Add this helper method to determine validation priority based on duplicates:
  getValidationPriority(contribution: Contribution): 'high' | 'medium' | 'low' {
    if (!contribution.duplicateDetection?.hasEmbedding) {
      return 'medium'; // Default priority
    }

    if (contribution.duplicateDetection.highSimilarityCount > 0) {
      return 'high'; // High priority - potential duplicates need careful review
    }

    if (contribution.duplicateDetection.similarCount === 0) {
      return 'low'; // Low priority - unique content is usually safer to validate
    }

    return 'medium'; // Medium priority - some similarities but not high confidence duplicates
  }

  // Add this method to get priority color for UI:
  getPriorityColor(contribution: Contribution): string {
    const priority = this.getValidationPriority(contribution);
    switch (priority) {
      case 'high':
        return 'warn';
      case 'medium':
        return 'primary';
      case 'low':
        return 'accent';
      default:
        return 'primary';
    }
  }

  // Add this method to get priority icon:
  getPriorityIcon(contribution: Contribution): string {
    const priority = this.getValidationPriority(contribution);
    switch (priority) {
      case 'high':
        return 'priority_high';
      case 'medium':
        return 'remove';
      case 'low':
        return 'check_circle';
      default:
        return 'help';
    }
  }
}

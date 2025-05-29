import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

import { Dataset, UpdateDatasetRequest } from '../../../core/models/dataset.model';
import { DatasetService } from '../../../core/services/dataset.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-dataset-edit',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDividerModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './dataset-edit.component.html',
  styleUrls: ['./dataset-edit.component.scss']
})
export class DatasetEditComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  public datasetId!: number;
  
  // Data properties
  dataset: Dataset | null = null;
  editForm: FormGroup;
  
  // Loading states
  isLoading = true;
  isSubmitting = false;
  
  // Tag management
  availableTags = [
    'machine-learning', 'deep-learning', 'computer-vision', 'nlp', 'classification',
    'regression', 'clustering', 'face-recognition', 'object-detection', 'sentiment-analysis',
    'medical', 'finance', 'education', 'social-media', 'research', 'audio', 'time-series',
    'recommendation', 'anomaly-detection', 'generative-ai', 'reinforcement-learning'
  ];
  
  // Form options
  visibilityOptions = [
    {
      value: 'public',
      label: 'Public',
      description: 'Anyone can view and contribute to this dataset',
      icon: 'public',
      recommended: false
    },
    {
      value: 'collaborative',
      label: 'Collaborative',
      description: 'Invited users can view and contribute',
      icon: 'group',
      recommended: true
    },
    {
      value: 'private',
      label: 'Private',
      description: 'Only you can view and manage this dataset',
      icon: 'lock',
      recommended: false
    }
  ];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private datasetService: DatasetService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.editForm = this.fb.group({
      name: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-Z0-9\s\-_().]+$/)
      ]],
      description: ['', [
        Validators.maxLength(2000)
      ]],
      visibility: ['', Validators.required],
      tags: this.fb.array([])
    });
  }
  
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
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Form getters for easier access
  get tagsArray() { return this.editForm.get('tags') as FormArray; }
  get name() { return this.editForm.get('name'); }
  get description() { return this.editForm.get('description'); }
  get visibility() { return this.editForm.get('visibility'); }
  
  // Load dataset data
  loadDataset(): void {
    this.isLoading = true;
    
    this.datasetService.getDatasetById(this.datasetId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (dataset) => {
        this.dataset = dataset;
        this.checkPermissions();
        this.populateForm();
        this.isLoading = false;
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
  
  // Check if user has permission to edit this dataset
  checkPermissions(): void {
    if (!this.dataset || !this.authService.currentUser) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: `/datasets/${this.datasetId}/edit` }
      });
      return;
    }
    
    const canEdit = Number(this.authService.currentUser.id) === this.dataset.ownerId || 
                   this.authService.hasRole('admin');
    
    if (!canEdit) {
      this.snackBar.open('You do not have permission to edit this dataset', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      this.router.navigate(['/datasets', this.datasetId]);
    }
  }
  
  // Populate form with existing dataset data
  populateForm(): void {
    if (!this.dataset) return;
    
    // Clear existing tags
    while (this.tagsArray.length !== 0) {
      this.tagsArray.removeAt(0);
    }
    
    // Populate basic fields
    this.editForm.patchValue({
      name: this.dataset.name,
      description: this.dataset.description || '',
      visibility: this.dataset.visibility
    });
    
    // Populate tags
    if (this.dataset.tags && this.dataset.tags.length > 0) {
      this.dataset.tags.forEach(tag => {
        this.tagsArray.push(this.fb.control(tag));
      });
    }
  }
  
  // Tag management methods
  addTag(tag: string): void {
    if (tag && !this.isTagSelected(tag)) {
      this.tagsArray.push(this.fb.control(tag));
    }
  }
  
  removeTag(index: number): void {
    this.tagsArray.removeAt(index);
  }
  
  isTagSelected(tag: string): boolean {
    return this.tagsArray.value.includes(tag);
  }
  
  // Get selected visibility info
  getSelectedVisibilityInfo() {
    const selectedVisibility = this.visibility?.value;
    return this.visibilityOptions.find(option => option.value === selectedVisibility);
  }
  
  // Form validation helpers
  getFieldError(fieldName: string): string | null {
    const field = this.editForm.get(fieldName);
    if (field && field.errors && field.touched) {
      const errors = field.errors;
      
      if (errors['required']) return 'This field is required';
      if (errors['minlength']) return `Minimum ${errors['minlength'].requiredLength} characters required`;
      if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters allowed`;
      if (errors['pattern']) return 'Invalid characters detected';
    }
    return null;
  }
  
  // Check if form has changes
  hasChanges(): boolean {
    if (!this.dataset) return false;
    
    const formValue = this.editForm.value;
    
    return (
      formValue.name !== this.dataset.name ||
      formValue.description !== (this.dataset.description || '') ||
      formValue.visibility !== this.dataset.visibility ||
      JSON.stringify(formValue.tags.sort()) !== JSON.stringify((this.dataset.tags || []).sort())
    );
  }
  
  // Form submission
  onSubmit(): void {
    if (this.editForm.valid && this.dataset) {
      this.isSubmitting = true;
      
      const formValue = this.editForm.value;
      const updateRequest: UpdateDatasetRequest = {
        name: formValue.name.trim(),
        description: formValue.description?.trim() || undefined,
        visibility: formValue.visibility,
        tags: formValue.tags || []
      };
      
      this.datasetService.updateDataset(this.dataset.id, updateRequest).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (updatedDataset) => {
          this.dataset = updatedDataset;
          this.snackBar.open('Dataset updated successfully!', 'Close', {
            duration: 5000,
            panelClass: ['success-snackbar']
          });
          
          // Navigate back to dataset detail
          this.router.navigate(['/datasets', this.dataset.id]);
        },
        error: (error) => {
          console.error('Error updating dataset:', error);
          this.snackBar.open(
            error.message || 'Failed to update dataset. Please try again.',
            'Close',
            {
              duration: 7000,
              panelClass: ['error-snackbar']
            }
          );
          this.isSubmitting = false;
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.editForm);
      this.snackBar.open('Please correct the errors in the form', 'Close', {
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
    }
  }
  
  // Helper to mark all form controls as touched
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else {
        control?.markAsTouched();
      }
    });
  }
  
  // Cancel editing
  onCancel(): void {
    if (this.hasChanges()) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        this.router.navigate(['/datasets', this.datasetId]);
      }
    } else {
      this.router.navigate(['/datasets', this.datasetId]);
    }
  }
  
  // Reset form to original values
  resetForm(): void {
    if (confirm('Are you sure you want to reset all changes?')) {
      this.populateForm();
      this.snackBar.open('Form reset to original values', 'Close', {
        duration: 3000
      });
    }
  }
  
  // Get display values for the dataset
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
}
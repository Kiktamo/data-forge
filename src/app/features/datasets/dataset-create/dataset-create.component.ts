import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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
import { MatStepperModule } from '@angular/material/stepper';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Dataset, CreateDatasetRequest } from '../../../core/models/dataset.model';
import { DatasetService } from '../../../core/services/dataset.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-dataset-create',
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
    MatStepperModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './dataset-create.component.html',
  styleUrls: ['./dataset-create.component.scss']
})
export class DatasetCreateComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  createForm: FormGroup;
  isSubmitting = false;
  isLinear = false;
  
  // Tag management
  availableTags = [
    'machine-learning', 'deep-learning', 'computer-vision', 'nlp', 'classification',
    'regression', 'clustering', 'face-recognition', 'object-detection', 'sentiment-analysis',
    'medical', 'finance', 'education', 'social-media', 'research', 'audio', 'time-series',
    'recommendation', 'anomaly-detection', 'generative-ai', 'reinforcement-learning'
  ];
  
  // Form options
  dataTypeOptions = [
    {
      value: 'image',
      label: 'Image Data',
      description: 'Photos, screenshots, drawings, medical images, etc.',
      icon: 'image',
      examples: ['Photos', 'Medical scans', 'Satellite imagery', 'Artwork']
    },
    {
      value: 'text',
      label: 'Text Data',
      description: 'Documents, articles, reviews, social media posts, etc.',
      icon: 'text_fields',
      examples: ['Articles', 'Reviews', 'Social posts', 'Research papers']
    },
    {
      value: 'structured',
      label: 'Structured Data',
      description: 'CSV files, databases, surveys, sensor data, etc.',
      icon: 'table_chart',
      examples: ['CSV files', 'Sensor data', 'Survey responses', 'Financial data']
    }
  ];
  
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
    private fb: FormBuilder,
    private datasetService: DatasetService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.createForm = this.fb.group({
      // Basic Information
      basicInfo: this.fb.group({
        name: ['', [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z0-9\s\-_().]+$/)
        ]],
        description: ['', [
          Validators.maxLength(2000)
        ]]
      }),
      
      // Dataset Configuration
      configuration: this.fb.group({
        dataType: ['', Validators.required],
        visibility: ['collaborative', Validators.required],
        tags: this.fb.array([])
      }),
      
      // Additional Settings
      settings: this.fb.group({
        allowPublicContributions: [true],
        requireValidation: [true],
        autoPublish: [false]
      })
    });
  }
  
  ngOnInit(): void {
    // Check authentication
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: '/datasets/new' }
      });
      return;
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Form getters for easier access
  get basicInfo() { return this.createForm.get('basicInfo') as FormGroup; }
  get configuration() { return this.createForm.get('configuration') as FormGroup; }
  get settings() { return this.createForm.get('settings') as FormGroup; }
  get tagsArray() { return this.configuration.get('tags') as FormArray; }
  
  // Individual field getters
  get name() { return this.basicInfo.get('name'); }
  get description() { return this.basicInfo.get('description'); }
  get dataType() { return this.configuration.get('dataType'); }
  get visibility() { return this.configuration.get('visibility'); }
  
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
  
  // Get selected data type info
  getSelectedDataTypeInfo() {
    const selectedType = this.dataType?.value;
    return this.dataTypeOptions.find(option => option.value === selectedType);
  }
  
  // Get selected visibility info
  getSelectedVisibilityInfo() {
    const selectedVisibility = this.visibility?.value;
    return this.visibilityOptions.find(option => option.value === selectedVisibility);
  }
  
  // Form validation helpers
  getFieldError(fieldPath: string): string | null {
    const field = this.createForm.get(fieldPath);
    if (field && field.errors && field.touched) {
      const errors = field.errors;
      
      if (errors['required']) return 'This field is required';
      if (errors['minlength']) return `Minimum ${errors['minlength'].requiredLength} characters required`;
      if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters allowed`;
      if (errors['pattern']) return 'Invalid characters detected';
    }
    return null;
  }
  
  // Step completion checks
  isBasicInfoComplete(): boolean {
    return this.basicInfo.valid;
  }
  
  isConfigurationComplete(): boolean {
    return this.configuration.valid;
  }
  
  isSettingsComplete(): boolean {
    return this.settings.valid;
  }
  
  // Form submission
  onSubmit(): void {
    if (this.createForm.valid) {
      this.isSubmitting = true;
      
      const formValue = this.createForm.value;
      const createRequest: CreateDatasetRequest = {
        name: formValue.basicInfo.name.trim(),
        description: formValue.basicInfo.description?.trim() || undefined,
        dataType: formValue.configuration.dataType,
        visibility: formValue.configuration.visibility,
        tags: formValue.configuration.tags || []
      };
      
      this.datasetService.createDataset(createRequest).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (dataset) => {
          this.snackBar.open('Dataset created successfully!', 'Close', {
            duration: 5000,
            panelClass: ['success-snackbar']
          });
          
          // Navigate to the new dataset
          this.router.navigate(['/datasets', dataset.id]);
        },
        error: (error) => {
          console.error('Error creating dataset:', error);
          this.snackBar.open(
            error.message || 'Failed to create dataset. Please try again.',
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
      this.markFormGroupTouched(this.createForm);
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
  
  // Cancel and go back
  onCancel(): void {
    if (this.createForm.dirty) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        this.router.navigate(['/datasets']);
      }
    } else {
      this.router.navigate(['/datasets']);
    }
  }
  
  // Save as draft (future feature)
  saveDraft(): void {
    this.snackBar.open('Draft saving is not yet available', 'Close', {
      duration: 3000
    });
  }
}
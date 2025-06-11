import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';

import { Dataset } from '../../../core/models/dataset.model';
import { DatasetService } from '../../../core/services/dataset.service';
import { ContributionService } from '../../../core/services/contribution.service';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/web-socket.service';

interface ContributionData {
  description?: string;
  tags?: string[];
  annotations?: any;
  file?: File;
  textContent?: string;
  structuredData?: any;
}

@Component({
  selector: 'app-contribution-create',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatStepperModule,
    MatTabsModule,
    MatTooltipModule,
    MatDialogModule,
    MatDividerModule,
    MatSelectModule
  ],
  templateUrl: './contribution-create.component.html',
  styleUrl: './contribution-create.component.scss'
})
export class ContributionCreateComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  protected datasetId!: number;
  
  // Data properties
  dataset: Dataset | null = null;
  contributionForm: FormGroup;
  
  // File handling
  selectedFile: File | null = null;
  selectedStructuredFile: File | null = null;
  previewUrl: string | null = null;
  isDragOver = false;
  
  // Tags and labels
  contributionTags: string[] = [];
  imageLabels: string[] = [];
  labelControl: any;
  tagControl: any;
  separatorKeysCodes: number[] = [13, 188]; // Enter, comma
  
  // Loading states
  isLoadingDataset = true;
  isSubmitting = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private datasetService: DatasetService,
    private contributionService: ContributionService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private wsService: WebSocketService
  ) {
    this.contributionForm = this.fb.group({
      // Common fields
      description: ['', [Validators.maxLength(1000)]],
      
      // Image fields
      imageDescription: [''],
      
      // Text fields
      textContent: [''],
      textCategory: [''],
      sentiment: [''],
      
      // Structured data fields
      jsonData: [''],
      schemaDescription: ['']
    });

    this.labelControl = this.fb.control('');
    this.tagControl = this.fb.control('');
  }
  
  ngOnInit(): void {
    // Check authentication
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }
    
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
    this.wsService.leaveDataset();
    
    // Clean up object URLs
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Form getters for easier access
  get description() { return this.contributionForm.get('description'); }
  get textContent() { return this.contributionForm.get('textContent'); }
  get jsonData() { return this.contributionForm.get('jsonData'); }
  
  // Load dataset data
  loadDataset(): void {
    this.isLoadingDataset = true;
    
    this.datasetService.getDatasetById(this.datasetId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (dataset) => {
        this.dataset = dataset;
        this.checkContributionPermissions();
        this.setupFormValidation();
        
        // Join dataset for real-time updates
        this.wsService.joinDataset(dataset.id);
        
        this.isLoadingDataset = false;
      },
      error: (error) => {
        console.error('Error loading dataset:', error);
        this.isLoadingDataset = false;
        
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
  
  // Check if user can contribute to this dataset
  checkContributionPermissions(): void {
    if (!this.dataset || !this.authService.currentUser) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: `/datasets/${this.datasetId}/contribute` }
      });
      return;
    }
    
    const canContribute = this.dataset.visibility !== 'private' || 
                         Number(this.authService.currentUser.id) === this.dataset.ownerId;
    
    if (!canContribute) {
      this.snackBar.open('You do not have permission to contribute to this dataset', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      this.router.navigate(['/datasets', this.datasetId]);
    }
  }
  
  // Setup form validation based on data type
  setupFormValidation(): void {
    if (!this.dataset) return;
    
    switch (this.dataset.dataType) {
      case 'text':
        this.contributionForm.get('textContent')?.setValidators([
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(50000)
        ]);
        break;
      case 'structured':
        // JSON validation will be handled in the validator
        break;
    }
    
    this.contributionForm.updateValueAndValidity();
  }
  
  // File upload handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }
  
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }
  
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }
  
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileSelection(input.files[0]);
    }
  }
  
  onStructuredFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedStructuredFile = input.files[0];
    }
  }
  
  private handleFileSelection(file: File): void {
    // Validate file type and size
    if (!this.validateFile(file)) {
      return;
    }
    
    this.selectedFile = file;
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      if (this.previewUrl) {
        URL.revokeObjectURL(this.previewUrl);
      }
      this.previewUrl = URL.createObjectURL(file);
    }
  }
  
  private validateFile(file: File): boolean {
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (file.size > maxSize) {
      this.snackBar.open('File size must be less than 10MB', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      return false;
    }
    
    // Validate file type based on dataset type
    if (this.dataset?.dataType === 'image' && !file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      return false;
    }
    
    return true;
  }
  
  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }
  
  removeStructuredFile(event: Event): void {
    event.stopPropagation();
    this.selectedStructuredFile = null;
  }
  
  // Tag management
  addTag(event: any): void {
    const value = (event.value || '').trim();
    if (value && !this.contributionTags.includes(value)) {
      this.contributionTags.push(value);
    }
    event.chipInput!.clear();
    this.tagControl.setValue(null);
  }
  
  removeTag(tag: string): void {
    const index = this.contributionTags.indexOf(tag);
    if (index >= 0) {
      this.contributionTags.splice(index, 1);
    }
  }
  
  addLabel(event: any): void {
    const value = (event.value || '').trim();
    if (value && !this.imageLabels.includes(value)) {
      this.imageLabels.push(value);
    }
    event.chipInput!.clear();
    this.labelControl.setValue(null);
  }
  
  removeLabel(label: string): void {
    const index = this.imageLabels.indexOf(label);
    if (index >= 0) {
      this.imageLabels.splice(index, 1);
    }
  }
  
  // Validation helpers
  getFieldError(fieldName: string): string | null {
    const field = this.contributionForm.get(fieldName);
    if (field && field.errors && field.touched) {
      const errors = field.errors;
      
      if (errors['required']) return 'This field is required';
      if (errors['minlength']) return `Minimum ${errors['minlength'].requiredLength} characters required`;
      if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters allowed`;
    }
    return null;
  }
  
  isFormValid(): boolean {
    if (!this.dataset) return false;
    
    switch (this.dataset.dataType) {
      case 'image':
        return !!this.selectedFile;
      case 'text':
        return this.contributionForm.get('textContent')?.valid || false;
      case 'structured':
        return !!(this.selectedStructuredFile || this.contributionForm.get('jsonData')?.value);
      default:
        return false;
    }
  }
  
  hasContent(): boolean {
    return this.isFormValid() || 
           !!this.contributionForm.get('description')?.value ||
           this.contributionTags.length > 0;
  }
  
  // Utility methods
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
  
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Form submission
  onSubmit(): void {
    if (!this.isFormValid() || !this.dataset) return;
    
    this.isSubmitting = true;
    
    const formData = new FormData();
    const formValue = this.contributionForm.value;
    
    // Add file if present
    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }
    if (this.selectedStructuredFile) {
      formData.append('file', this.selectedStructuredFile);
    }
    
    // Add form data
    formData.append('description', formValue.description || '');
    formData.append('tags', JSON.stringify(this.contributionTags));
    
    // Build annotations based on data type
    const annotations: any = {};
    
    switch (this.dataset.dataType) {
      case 'image':
        annotations.description = formValue.imageDescription || '';
        annotations.labels = this.imageLabels;
        break;
      case 'text':
        annotations.category = formValue.textCategory || '';
        annotations.sentiment = formValue.sentiment || '';
        if (formValue.textContent) {
          formData.append('textContent', formValue.textContent);
        }
        break;
      case 'structured':
        annotations.schemaDescription = formValue.schemaDescription || '';
        if (formValue.jsonData) {
          formData.append('structuredData', formValue.jsonData);
        }
        break;
    }
    
    formData.append('annotations', JSON.stringify(annotations));
    
    this.contributionService.createContribution(this.datasetId, formData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (contribution) => {
        this.snackBar.open('Contribution submitted successfully!', 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        
        // Navigate to dataset detail page
        this.router.navigate(['/datasets', this.datasetId]);
      },
      error: (error) => {
        console.error('Error creating contribution:', error);
        this.snackBar.open(
          error.message || 'Failed to submit contribution. Please try again.',
          'Close',
          {
            duration: 7000,
            panelClass: ['error-snackbar']
          }
        );
        this.isSubmitting = false;
      }
    });
  }
  
  // Cancel and go back
  onCancel(): void {
    if (this.hasContent()) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        this.router.navigate(['/datasets', this.datasetId]);
      }
    } else {
      this.router.navigate(['/datasets', this.datasetId]);
    }
  }
  
  // Save as draft (future feature)
  saveDraft(): void {
    this.snackBar.open('Draft saving is not yet available', 'Close', {
      duration: 3000
    });
  }
}
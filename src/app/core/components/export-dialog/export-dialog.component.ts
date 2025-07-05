import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatasetService, ExportOptions } from '../../../core/services/dataset.service';
import { Dataset } from '../../../core/models/dataset.model';

interface ExportDialogData {
  dataset: Dataset;
  isOwner: boolean;
}

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './export-dialog.component.html',
  styleUrl: './export-dialog.component.scss'
})
export class ExportDialogComponent implements OnInit {
  exportForm: FormGroup;
  isExporting = false;
  stats: any = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ExportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExportDialogData,
    private datasetService: DatasetService,
    private snackBar: MatSnackBar
  ) {
    this.exportForm = this.fb.group({
      format: ['zip', Validators.required],
      includePending: [false],
      includeRejected: [false]
    });
  }

  ngOnInit(): void {
    this.loadExportInfo();
  }

  private loadExportInfo(): void {
    this.datasetService.getExportInfo(this.data.dataset.id).subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('Error loading export info:', error);
        // Continue without stats
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onExport(): void {
    if (this.exportForm.valid && !this.isExporting) {
      this.isExporting = true;

      const options: ExportOptions = {
        format: this.exportForm.value.format,
        includeRejected: this.data.isOwner ? this.exportForm.value.includeRejected : false,
        includePending: this.data.isOwner ? this.exportForm.value.includePending : false
      };

      this.datasetService.exportDataset(this.data.dataset.id, options).subscribe({
        next: () => {
          this.isExporting = false;
          this.snackBar.open('Dataset export started successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.isExporting = false;
          console.error('Export error:', error);
          this.snackBar.open(`Export failed: ${error.message}`, 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }
}
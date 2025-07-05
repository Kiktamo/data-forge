import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { Contribution } from '../../../core/models/contribution.model';

interface DuplicateResult {
  contributionId: number;
  similarity: number;
  contribution: Contribution;
  contentExcerpt: string;
}

interface DuplicateDialogData {
  type: 'warning' | 'info';
  duplicates: DuplicateResult[];
  title?: string;
  message?: string;
}

@Component({
  selector: 'app-duplicate-dialog',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  template: `
    <div class="duplicate-dialog">
      <h2 mat-dialog-title>
        <mat-icon [color]="data.type === 'warning' ? 'warn' : 'primary'">
          {{ data.type === 'warning' ? 'warning' : 'info' }}
        </mat-icon>
        {{ data.title || getDefaultTitle() }}
      </h2>
      
      <mat-dialog-content>
        <p class="dialog-message">
          {{ data.message || getDefaultMessage() }}
        </p>
        
        <div class="duplicate-list" *ngIf="data.duplicates.length > 0">
          <mat-card *ngFor="let duplicate of data.duplicates" class="duplicate-card">
            <mat-card-content>
              <div class="duplicate-header">
                <div class="similarity-badge" [ngClass]="getSimilarityClass(duplicate.similarity)">
                  {{ (duplicate.similarity * 100) | number:'1.0-0' }}% similar
                </div>
                <span class="contribution-id">ID: {{ duplicate.contributionId }}</span>
              </div>
              
              <p class="content-excerpt" *ngIf="duplicate.contentExcerpt">
                {{ duplicate.contentExcerpt }}
              </p>
              
              <div class="duplicate-meta">
                <span class="contributor" *ngIf="duplicate.contribution.contributor">
                  <mat-icon>person</mat-icon>
                  {{ duplicate.contribution.contributor.username }}
                </span>
                <span class="created-date">
                  <mat-icon>schedule</mat-icon>
                  {{ duplicate.contribution.created_at | date:'short' }}
                </span>
                <span class="status-badge" [ngClass]="duplicate.contribution.validationStatus">
                  {{ getStatusLabel(duplicate.contribution.validationStatus) }}
                </span>
              </div>
            </mat-card-content>
            
            <mat-card-actions>
              <button 
                mat-button 
                [routerLink]="['/contributions', duplicate.contributionId]"
                (click)="onViewDetails(duplicate.contributionId)"
              >
                View Details
              </button>
            </mat-card-actions>
          </mat-card>
        </div>
        
        <div class="no-details" *ngIf="data.duplicates.length === 0">
          <mat-icon>info</mat-icon>
          <p>No detailed information available for similar contributions.</p>
        </div>
      </mat-dialog-content>
      
      <mat-dialog-actions align="end">
        <button mat-button (click)="onDismiss()">
          {{ data.type === 'warning' ? 'Continue Anyway' : 'Got It' }}
        </button>
        <button 
          mat-raised-button 
          color="primary" 
          (click)="onReview()" 
          *ngIf="data.type === 'warning' && data.duplicates.length > 0"
        >
          Review Duplicates
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .duplicate-dialog {
      min-width: 500px;
      max-width: 700px;
    }

    .dialog-message {
      margin-bottom: 20px;
      font-size: 14px;
      line-height: 1.5;
    }

    .duplicate-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .duplicate-card {
      margin-bottom: 16px;
    }

    .duplicate-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .similarity-badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .similarity-badge.high { 
      background: #ffebee; 
      color: #c62828; 
    }
    
    .similarity-badge.medium { 
      background: #fff3e0; 
      color: #ef6c00; 
    }
    
    .similarity-badge.low { 
      background: #e8f5e8; 
      color: #2e7d32; 
    }

    .contribution-id {
      font-size: 12px;
      color: #666;
      font-family: 'Courier New', monospace;
    }

    .content-excerpt {
      margin: 8px 0;
      font-size: 13px;
      color: #555;
      font-style: italic;
      border-left: 3px solid #e0e0e0;
      padding-left: 12px;
    }

    .duplicate-meta {
      display: flex;
      gap: 16px;
      align-items: center;
      font-size: 12px;
      color: #666;
      flex-wrap: wrap;
    }

    .duplicate-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .duplicate-meta mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .status-badge {
      padding: 2px 6px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .status-badge.pending {
      background: #fff3e0;
      color: #ef6c00;
    }

    .status-badge.approved {
      background: #e8f5e8;
      color: #2e7d32;
    }

    .status-badge.rejected {
      background: #ffebee;
      color: #c62828;
    }

    .no-details {
      text-align: center;
      padding: 20px;
      color: #666;
    }

    .no-details mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    mat-dialog-actions {
      margin-top: 16px;
    }

    button[mat-raised-button] {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    @media (max-width: 600px) {
      .duplicate-dialog {
        min-width: 300px;
        max-width: 400px;
      }

      .duplicate-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .duplicate-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
    }
  `]
})
export class DuplicateDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<DuplicateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DuplicateDialogData
  ) {}

  getDefaultTitle(): string {
    return this.data.type === 'warning' 
      ? 'Potential Duplicates Found' 
      : 'Similar Contributions Found';
  }

  getDefaultMessage(): string {
    const count = this.data.duplicates.length;
    if (this.data.type === 'warning') {
      return `We found ${count} potentially duplicate contribution${count !== 1 ? 's' : ''}. Please review them before proceeding.`;
    } else {
      return `We found ${count} similar contribution${count !== 1 ? 's' : ''} that you might want to review.`;
    }
  }

  getSimilarityClass(similarity: number): string {
    if (similarity >= 0.85) return 'high';
    if (similarity >= 0.75) return 'medium';
    return 'low';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  }

  onDismiss(): void {
    this.dialogRef.close({ action: 'dismiss' });
  }

  onReview(): void {
    this.dialogRef.close({ action: 'review' });
  }

  onViewDetails(contributionId: number): void {
    this.dialogRef.close({ action: 'view', contributionId });
  }
}
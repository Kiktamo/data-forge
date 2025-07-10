import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

import { Dataset } from '../../../core/models/dataset.model';
import { ContributionService } from '../../../core/services/contribution.service';
import { DatasetService } from '../../../core/services/dataset.service';

interface ActivityEvent {
  id: string;
  type: 'contribution_added' | 'contribution_validated' | 'dataset_updated' | 'version_created';
  timestamp: Date;
  title: string;
  description: string;
  metadata: {
    contributionId?: number;
    contributorName?: string;
    validatorName?: string;
    validationStatus?: string;
    versionNumber?: string;
    changeType?: string;
  };
  icon: string;
  iconColor: string;
}

@Component({
  selector: 'app-dataset-activity-timeline',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatBadgeModule
  ],
  template: `
    <div class="activity-timeline-container">
      
      <!-- Loading State -->
      <div class="timeline-loading" *ngIf="isLoading">
        <mat-spinner diameter="24"></mat-spinner>
        <span>Loading activity...</span>
      </div>

      <!-- Timeline -->
      <div class="activity-timeline" *ngIf="!isLoading && activities.length > 0">
        <div *ngFor="let activity of activities; let last = last" 
             class="timeline-item" 
             [class.last-item]="last">
          
          <div class="timeline-marker">
            <div class="marker-icon" [ngStyle]="{'background-color': activity.iconColor}">
              <mat-icon>{{ activity.icon }}</mat-icon>
            </div>
            <div class="timeline-line" *ngIf="!last"></div>
          </div>

          <div class="timeline-content">
            <div class="activity-header">
              <h4 class="activity-title">{{ activity.title }}</h4>
              <span class="activity-time" [matTooltip]="activity.timestamp | date:'medium'">
                {{ getRelativeTime(activity.timestamp) }}
              </span>
            </div>
            
            <p class="activity-description">{{ activity.description }}</p>
            
            <div class="activity-metadata" *ngIf="activity.metadata">
              <span *ngIf="activity.metadata.contributorName" class="metadata-chip contributor">
                <mat-icon>person</mat-icon>
                {{ activity.metadata.contributorName }}
              </span>
              <span *ngIf="activity.metadata.validatorName" class="metadata-chip validator">
                <mat-icon>verified_user</mat-icon>
                {{ activity.metadata.validatorName }}
              </span>
              <span *ngIf="activity.metadata.validationStatus" 
                    class="metadata-chip status"
                    [ngClass]="'status-' + activity.metadata.validationStatus">
                {{ activity.metadata.validationStatus | titlecase }}
              </span>
              <span *ngIf="activity.metadata.versionNumber" class="metadata-chip version">
                <mat-icon>new_releases</mat-icon>
                v{{ activity.metadata.versionNumber }}
              </span>
            </div>
          </div>

        </div>
      </div>

      <!-- Empty State -->
      <div class="no-activity" *ngIf="!isLoading && activities.length === 0">
        <mat-icon>timeline</mat-icon>
        <h3>No Recent Activity</h3>
        <p>This dataset doesn't have any recent activity to display.</p>
      </div>

      <!-- Load More Button -->
      <div class="timeline-actions" *ngIf="!isLoading && activities.length > 0 && hasMoreActivities">
        <button mat-button color="primary" (click)="loadMoreActivities()" [disabled]="isLoadingMore">
          <mat-spinner *ngIf="isLoadingMore" diameter="16"></mat-spinner>
          <span *ngIf="!isLoadingMore">Load More Activity</span>
          <span *ngIf="isLoadingMore">Loading...</span>
        </button>
      </div>

    </div>
  `,
  styles: [`
    .activity-timeline-container {
      .timeline-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 32px;
        color: #666;
        font-size: 0.9rem;
      }

      .activity-timeline {
        position: relative;
        padding: 16px 0;

        .timeline-item {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;

          &.last-item {
            margin-bottom: 0;
          }

          .timeline-marker {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;

            .marker-icon {
              width: 40px;
              height: 40px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              z-index: 2;

              mat-icon {
                color: white;
                font-size: 20px;
                width: 20px;
                height: 20px;
              }
            }

            .timeline-line {
              width: 2px;
              flex: 1;
              background: #e0e0e0;
              margin-top: 8px;
              min-height: 24px;
            }
          }

          .timeline-content {
            flex: 1;
            padding-bottom: 8px;

            .activity-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 8px;

              .activity-title {
                margin: 0;
                font-size: 1rem;
                font-weight: 500;
                color: #333;
                line-height: 1.3;
              }

              .activity-time {
                font-size: 0.8rem;
                color: #666;
                white-space: nowrap;
                margin-left: 16px;
              }
            }

            .activity-description {
              margin: 0 0 12px 0;
              color: #666;
              font-size: 0.9rem;
              line-height: 1.4;
            }

            .activity-metadata {
              display: flex;
              gap: 8px;
              flex-wrap: wrap;

              .metadata-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 500;

                mat-icon {
                  font-size: 14px;
                  width: 14px;
                  height: 14px;
                }

                &.contributor {
                  background: #e3f2fd;
                  color: #1976d2;
                }

                &.validator {
                  background: #e8f5e8;
                  color: #4caf50;
                }

                &.version {
                  background: #f3e5f5;
                  color: #9c27b0;
                }

                &.status {
                  &.status-approved {
                    background: #e8f5e8;
                    color: #4caf50;
                  }

                  &.status-rejected {
                    background: #ffebee;
                    color: #f44336;
                  }

                  &.status-pending {
                    background: #fff3e0;
                    color: #ff9800;
                  }
                }
              }
            }
          }
        }
      }

      .no-activity {
        text-align: center;
        padding: 48px;
        color: #666;

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: #ddd;
          margin-bottom: 16px;
        }

        h3 {
          margin: 0 0 8px 0;
          font-size: 1.2rem;
          font-weight: 400;
        }

        p {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.4;
        }
      }

      .timeline-actions {
        text-align: center;
        padding: 16px 0;
        border-top: 1px solid #f0f0f0;
        margin-top: 16px;

        button {
          min-width: 140px;
        }
      }
    }

    @media (max-width: 768px) {
      .activity-timeline-container {
        .activity-timeline {
          .timeline-item {
            .timeline-content {
              .activity-header {
                flex-direction: column;
                gap: 4px;

                .activity-time {
                  margin-left: 0;
                  align-self: flex-start;
                }
              }

              .activity-metadata {
                .metadata-chip {
                  font-size: 0.7rem;
                  padding: 2px 6px;
                }
              }
            }
          }
        }
      }
    }
  `]
})
export class DatasetActivityTimelineComponent implements OnInit, OnDestroy {
  @Input() dataset!: Dataset;
  @Input() maxItems = 10;

  private destroy$ = new Subject<void>();

  activities: ActivityEvent[] = [];
  isLoading = false;
  isLoadingMore = false;
  hasMoreActivities = false;
  currentPage = 1;

  constructor(
    private contributionService: ContributionService,
    private datasetService: DatasetService
  ) {}

  ngOnInit(): void {
    if (this.dataset) {
      this.loadActivities();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadActivities(): void {
    this.isLoading = true;
    this.currentPage = 1;

    this.loadActivityData().then(() => {
      this.isLoading = false;
    }).catch(error => {
      console.error('Error loading activities:', error);
      this.isLoading = false;
    });
  }

  loadMoreActivities(): void {
    if (this.isLoadingMore || !this.hasMoreActivities) return;
    
    this.isLoadingMore = true;
    this.currentPage++;

    this.loadActivityData().then(() => {
      this.isLoadingMore = false;
    }).catch(error => {
      console.error('Error loading more activities:', error);
      this.isLoadingMore = false;
    });
  }

  private async loadActivityData(): Promise<void> {
    try {
      // Get recent contributions for this dataset
      const contributionsResponse = await this.contributionService.getContributionsByDataset(
        this.dataset.id,
        {
          page: this.currentPage,
          limit: this.maxItems,
          sortBy: 'created_at',
          sortOrder: 'DESC'
        }
      ).toPromise();

      if (contributionsResponse) {
        const newActivities = this.createActivitiesFromContributions(contributionsResponse.data.contributions);
        
        if (this.currentPage === 1) {
          this.activities = newActivities;
        } else {
          this.activities = [...this.activities, ...newActivities];
        }

        this.hasMoreActivities = contributionsResponse.data.pagination.hasNext;
      }

      // Get dataset history if on first page
      if (this.currentPage === 1) {
        try {
          const historyResponse = await this.datasetService.getDatasetHistory(this.dataset.id, {
            page: 1,
            limit: 5,
            sortOrder: 'DESC'
          }).toPromise();

          if (historyResponse) {
            const historyActivities = this.createActivitiesFromHistory(historyResponse.data.history);
            this.activities = [...this.activities, ...historyActivities];
            
            // Sort all activities by timestamp
            this.activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          }
        } catch (historyError) {
          console.log('Dataset history not available');
        }
      }

    } catch (error) {
      throw error;
    }
  }

  private createActivitiesFromContributions(contributions: any[]): ActivityEvent[] {
    return contributions.map(contribution => {
      let activityType: ActivityEvent['type'] = 'contribution_added';
      let title = 'New Contribution Added';
      let description = `A new ${contribution.dataType} contribution was added to the dataset`;
      let icon = 'add_circle';
      let iconColor = '#1976d2';

      // Check if this contribution has been validated
      if (contribution.validationStatus === 'approved') {
        activityType = 'contribution_validated';
        title = 'Contribution Approved';
        description = `A ${contribution.dataType} contribution was approved by validators`;
        icon = 'check_circle';
        iconColor = '#4caf50';
      } else if (contribution.validationStatus === 'rejected') {
        activityType = 'contribution_validated';
        title = 'Contribution Rejected';
        description = `A ${contribution.dataType} contribution was rejected by validators`;
        icon = 'cancel';
        iconColor = '#f44336';
      }

      // Add description from metadata if available
      if (contribution.metadata?.description) {
        description += `: "${contribution.metadata.description.substring(0, 100)}${contribution.metadata.description.length > 100 ? '...' : ''}"`;
      }

      return {
        id: `contribution-${contribution.id}`,
        type: activityType,
        timestamp: new Date(contribution.created_at),
        title,
        description,
        metadata: {
          contributionId: contribution.id,
          contributorName: contribution.contributor?.username,
          validationStatus: contribution.validationStatus
        },
        icon,
        iconColor
      };
    });
  }

  private createActivitiesFromHistory(history: any[]): ActivityEvent[] {
    return history.slice(0, 3).map(version => ({ // Limit to 3 most recent versions
      id: `version-${version.id}`,
      type: 'version_created' as const,
      timestamp: new Date(version.version),
      title: 'Dataset Version Created',
      description: version.description || 'A new version of the dataset was created',
      metadata: {
        versionNumber: version.version || 'Unknown'
      },
      icon: 'new_releases',
      iconColor: '#9c27b0'
    }));
  }

  getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }
}
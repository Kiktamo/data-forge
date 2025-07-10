import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';

import { Dataset } from '../../../core/models/dataset.model';
import { DatasetService } from '../../../core/services/dataset.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environments';

interface DatasetAnalytics {
  qualityMetrics: {
    overallScore: number;
    validationRate: number;
    averageValidationTime: number;
    contributorDiversity: number;
    dataCompleteness: number;
  };
  contributionTrends: {
    daily: Array<{ date: Date; count: number }>;
    weekly: Array<{ week: string; count: number }>;
    monthly: Array<{ month: string; count: number }>;
  };
  duplicateAnalysis: {
    totalDuplicates: number;
    duplicateRate: number;
    highSimilarityPairs: number;
    embeddingCoverage: number;
  };
  contributorStats: {
    totalContributors: number;
    activeContributors: number;
    topContributors: Array<{
      username: string;
      contributionCount: number;
      validationRate: number;
    }>;
  };
  validationMetrics: {
    pendingCount: number;
    averageTimeToValidation: number;
    consensusRate: number;
    topValidators: Array<{
      username: string;
      validationCount: number;
      averageConfidence: number;
    }>;
  };
  biasDetection: {
    overallBiasScore: number;
    demographicDistribution: any;
    contentDiversity: number;
    recommendations: string[];
  };
}

@Component({
  selector: 'app-dataset-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatButtonModule,
    MatTooltipModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatDividerModule
  ],
  templateUrl: './dataset-analytics.component.html',
  styleUrls: ['./dataset-analytics.component.scss']
})
export class DatasetAnalyticsComponent implements OnInit, OnDestroy {
  @Input() dataset!: Dataset;
  @Input() showFullAnalytics = false; // Toggle between summary and full analytics

  private destroy$ = new Subject<void>();
  private apiUrl = `${environment.apiUrl}`;

  // Data
  analytics: DatasetAnalytics | null = null;
  isLoading = false;
  isLoadingDuplicates = false;

  // UI State
  selectedTimeRange: '7d' | '30d' | '90d' | 'all' = '30d';

  constructor(
    private datasetService: DatasetService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (this.dataset) {
      this.loadAnalytics();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAnalytics(): void {
    this.isLoading = true;

    // For now, I'll build analytics from existing API calls
    // In a full implementation, you'd have a dedicated analytics endpoint
    Promise.all([
      this.loadQualityMetrics(),
      this.loadDuplicateAnalysis(),
      this.loadContributorStats(),
      this.loadValidationMetrics()
    ]).then(() => {
      this.isLoading = false;
    }).catch(error => {
      console.error('Error loading analytics:', error);
      this.isLoading = false;
    });
  }

  private async loadQualityMetrics(): Promise<void> {
    try {
      const stats = await this.datasetService.getDatasetStats(this.dataset.id).toPromise();
      if (!this.analytics) this.analytics = this.getEmptyAnalytics();
      
      const validationRate = stats.totalContributions > 0 
        ? (stats.validatedContributions / stats.totalContributions) * 100 
        : 0;

      this.analytics.qualityMetrics = {
        overallScore: validationRate * 0.8, // Simplified calculation
        validationRate,
        averageValidationTime: 120, // Would come from validation data
        contributorDiversity: 75, // Placeholder - would need contributor analysis
        dataCompleteness: validationRate
      };
    } catch (error) {
      console.error('Error loading quality metrics:', error);
    }
  }

  private async loadDuplicateAnalysis(): Promise<void> {
    this.isLoadingDuplicates = true;
    try {
      // Check if admin endpoint is available
      const duplicateData = await this.http.get<any>(`${this.apiUrl}/admin/datasets/${this.dataset.id}/duplicates`).toPromise();
      
      if (!this.analytics) this.analytics = this.getEmptyAnalytics();
      
      this.analytics.duplicateAnalysis = {
        totalDuplicates: duplicateData.data?.duplicatePairs?.length || 0,
        duplicateRate: this.calculateDuplicateRate(duplicateData.data?.duplicatePairs?.length || 0),
        highSimilarityPairs: duplicateData.data?.duplicatePairs?.filter((p: any) => p.similarity >= 0.9).length || 0,
        embeddingCoverage: 85 // Would come from embedding status
      };
    } catch (error) {
      // Fallback if admin endpoint not accessible
      if (!this.analytics) this.analytics = this.getEmptyAnalytics();
      this.analytics.duplicateAnalysis = {
        totalDuplicates: 0,
        duplicateRate: 0,
        highSimilarityPairs: 0,
        embeddingCoverage: 0
      };
    }
    this.isLoadingDuplicates = false;
  }

  private async loadContributorStats(): Promise<void> {
    try {
      // This would need a dedicated endpoint - for now use placeholder data
      if (!this.analytics) this.analytics = this.getEmptyAnalytics();
      
      this.analytics.contributorStats = {
        totalContributors: Math.floor(this.dataset.contributionCount * 0.7), // Estimate
        activeContributors: Math.floor(this.dataset.contributionCount * 0.3), // Estimate
        topContributors: [] // Would need contribution data with contributor info
      };
    } catch (error) {
      console.error('Error loading contributor stats:', error);
    }
  }

  private async loadValidationMetrics(): Promise<void> {
    try {
      if (!this.analytics) this.analytics = this.getEmptyAnalytics();
      
      const pendingCount = (this.dataset.contributionCount || 0) - (this.dataset.validationCount || 0);
      
      this.analytics.validationMetrics = {
        pendingCount,
        averageTimeToValidation: 24 * 60, // 24 hours in minutes - placeholder
        consensusRate: 85, // Placeholder
        topValidators: [] // Would need validation data
      };

      // Placeholder bias detection
      this.analytics.biasDetection = {
        overallBiasScore: 75, // Higher is better
        demographicDistribution: {},
        contentDiversity: 80,
        recommendations: [
          'Consider adding more diverse data sources',
          'Review geographic distribution of contributions',
          'Ensure balanced representation across categories'
        ]
      };
    } catch (error) {
      console.error('Error loading validation metrics:', error);
    }
  }

  private getEmptyAnalytics(): DatasetAnalytics {
    return {
      qualityMetrics: {
        overallScore: 0,
        validationRate: 0,
        averageValidationTime: 0,
        contributorDiversity: 0,
        dataCompleteness: 0
      },
      contributionTrends: {
        daily: [],
        weekly: [],
        monthly: []
      },
      duplicateAnalysis: {
        totalDuplicates: 0,
        duplicateRate: 0,
        highSimilarityPairs: 0,
        embeddingCoverage: 0
      },
      contributorStats: {
        totalContributors: 0,
        activeContributors: 0,
        topContributors: []
      },
      validationMetrics: {
        pendingCount: 0,
        averageTimeToValidation: 0,
        consensusRate: 0,
        topValidators: []
      },
      biasDetection: {
        overallBiasScore: 0,
        demographicDistribution: {},
        contentDiversity: 0,
        recommendations: []
      }
    };
  }

  private calculateDuplicateRate(duplicateCount: number): number {
    if (!this.dataset.contributionCount || this.dataset.contributionCount === 0) return 0;
    return (duplicateCount / this.dataset.contributionCount) * 100;
  }

  // === UTILITY METHODS ===

  getQualityScoreColor(score: number): string {
    if (score >= 80) return 'primary';
    if (score >= 60) return 'accent';
    return 'warn';
  }

  getBiasScoreColor(score: number): string {
    if (score >= 80) return 'primary';
    if (score >= 60) return 'accent';
    return 'warn';
  }

  getDuplicateRateColor(rate: number): string {
    if (rate <= 5) return 'primary';
    if (rate <= 15) return 'accent';
    return 'warn';
  }

  formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  formatPercentage(value: number): string {
    return `${Math.round(value)}%`;
  }

  refreshAnalytics(): void {
    this.loadAnalytics();
  }

  onTimeRangeChange(): void {
    // Would reload trend data for new time range
    console.log('Time range changed to:', this.selectedTimeRange);
  }
}
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface Contribution {
  id: string;
  datasetId: string;
  datasetName: string;
  contributionDate: Date;
  contentType: 'image' | 'text' | 'structured';
  status: 'pending' | 'approved' | 'rejected';
  validationCount: number;
}

@Component({
  selector: 'app-contribution-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatTabsModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './contribution-list.component.html',
  styleUrls: ['./contribution-list.component.scss']
})
export class ContributionListComponent implements OnInit {
  isLoading = true;
  contributions: Contribution[] = [];
  pendingContributions: Contribution[] = [];
  approvedContributions: Contribution[] = [];
  rejectedContributions: Contribution[] = [];
  
  ngOnInit(): void {
    // Simulate API call to fetch contributions
    setTimeout(() => {
      this.contributions = this.generateMockContributions(10);
      this.filterContributions();
      this.isLoading = false;
    }, 1000);
  }
  
  // Filter contributions by status
  private filterContributions(): void {
    this.pendingContributions = this.contributions.filter(c => c.status === 'pending');
    this.approvedContributions = this.contributions.filter(c => c.status === 'approved');
    this.rejectedContributions = this.contributions.filter(c => c.status === 'rejected');
  }
  
  private generateMockContributions(count: number): Contribution[] {
    const contributions: Contribution[] = [];
    const contentTypes: Array<'image' | 'text' | 'structured'> = ['image', 'text', 'structured'];
    const statuses: Array<'pending' | 'approved' | 'rejected'> = ['pending', 'approved', 'rejected'];
    
    for (let i = 1; i <= count; i++) {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
      
      contributions.push({
        id: `contrib-${i}`,
        datasetId: `ds-${Math.floor(Math.random() * 5) + 1}`,
        datasetName: `Dataset ${Math.floor(Math.random() * 5) + 1}`,
        contributionDate: date,
        contentType: contentTypes[Math.floor(Math.random() * contentTypes.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        validationCount: Math.floor(Math.random() * 5)
      });
    }
    
    return contributions;
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'approved':
        return 'status-approved';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-pending';
    }
  }
  
  getContentTypeIcon(type: string): string {
    switch (type) {
      case 'image':
        return 'image';
      case 'text':
        return 'text_fields';
      case 'structured':
        return 'table_chart';
      default:
        return 'data_object';
    }
  }
}
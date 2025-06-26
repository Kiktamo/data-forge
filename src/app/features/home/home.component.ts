import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Dataset } from '../../core/models/dataset.model';
import { DatasetService } from '../../core/services/dataset.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  // FIXED: Real featured datasets from API
  featuredDatasets: Dataset[] = [];
  isLoadingFeatured = false;
  
  constructor(private datasetService: DatasetService) {}
  
  ngOnInit(): void {
    this.loadFeaturedDatasets();
  }
  
  // Load featured datasets from API
  loadFeaturedDatasets(): void {
    this.isLoadingFeatured = true;
    
    // Get public datasets, sorted by contribution count, limit to 3
    this.datasetService.getDatasets({
      visibility: 'public',
      sortBy: 'contributionCount',
      sortOrder: 'DESC',
      limit: 3,
      page: 1
    }).subscribe({
      next: (response) => {
        this.featuredDatasets = response.data.datasets;
        
        // If we don't have enough public datasets, pad with mock data
        if (this.featuredDatasets.length < 3) {
          this.addMockDatasets();
        }
        
        this.isLoadingFeatured = false;
      },
      error: (error) => {
        console.error('Error loading featured datasets:', error);
        // Fallback to mock data
        this.addMockDatasets();
        this.isLoadingFeatured = false;
      }
    });
  }
  
  // Add mock datasets as fallback
  private addMockDatasets(): void {
    const mockDatasets = [
      {
        id: 'mock-1',
        name: 'Sample Image Dataset',
        description: 'A collection of sample images for demonstration purposes.',
        dataType: 'image',
        contributionCount: 125,
        visibility: 'public',
        tags: ['sample', 'demo', 'images'],
        owner: { username: 'demo-user', fullName: 'Demo User' }
      },
      {
        id: 'mock-2',
        name: 'Text Collection',
        description: 'Sample text data for natural language processing.',
        dataType: 'text',
        contributionCount: 89,
        visibility: 'public',
        tags: ['text', 'nlp', 'sample'],
        owner: { username: 'demo-user', fullName: 'Demo User' }
      },
      {
        id: 'mock-3',
        name: 'Structured Data Sample',
        description: 'Example structured data for analysis and modeling.',
        dataType: 'structured',
        contributionCount: 67,
        visibility: 'public',
        tags: ['structured', 'analysis', 'demo'],
        owner: { username: 'demo-user', fullName: 'Demo User' }
      }
    ];
    
    // Add mock datasets to fill up to 3 total
    while (this.featuredDatasets.length < 3 && mockDatasets.length > 0) {
      this.featuredDatasets.push(mockDatasets.shift() as any);
    }
  }
  
  // Get display name for dataset owner
  getOwnerDisplayName(dataset: Dataset): string {
    if (dataset.owner?.fullName) {
      return dataset.owner.fullName;
    }
    if (dataset.owner?.username) {
      return dataset.owner.username;
    }
    return 'Community';
  }
  
  // Get icon for data type
  getDataTypeIcon(dataType: string): string {
    switch (dataType) {
      case 'image': return 'image';
      case 'text': return 'text_fields';
      case 'structured': return 'table_chart';
      default: return 'dataset';
    }
  }
}
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

// This would be provided by the dataset service in the real implementation
interface Dataset {
  id: string;
  name: string;
  description: string;
  dataType: 'image' | 'text' | 'structured';
  visibility: 'public' | 'private' | 'collaborative';
  contributionCount: number;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  ownerName: string;
  tags: string[];
}

@Component({
  selector: 'app-dataset-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  templateUrl: './dataset-list.component.html',
  styleUrls: ['./dataset-list.component.scss']
})
export class DatasetListComponent implements OnInit {
  // Mock data for datasets
  datasets: Dataset[] = [];
  filteredDatasets: Dataset[] = [];
  isLoading = true;
  
  // Pagination settings
  pageSize = 9;
  pageSizeOptions = [3, 6, 9, 12, 24];
  pageIndex = 0;
  totalDatasets = 0;
  
  // Filter options
  searchQuery = '';
  selectedDataType = '';
  selectedSortOption = 'newest';
  
  dataTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'image', label: 'Images' },
    { value: 'text', label: 'Text' },
    { value: 'structured', label: 'Structured Data' }
  ];
  
  sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'name_asc', label: 'Name (A-Z)' },
    { value: 'name_desc', label: 'Name (Z-A)' },
    { value: 'contributions', label: 'Most Contributions' }
  ];
  
  ngOnInit(): void {
    // Simulate loading datasets from API
    setTimeout(() => {
      this.datasets = this.generateMockDatasets(30);
      this.applyFilters();
      this.isLoading = false;
    }, 1000);
  }
  
  // Apply filters and update the filtered datasets
  applyFilters(): void {
    let filtered = [...this.datasets];
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(dataset => 
        dataset.name.toLowerCase().includes(query) || 
        dataset.description.toLowerCase().includes(query) ||
        dataset.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Apply data type filter
    if (this.selectedDataType) {
      filtered = filtered.filter(dataset => dataset.dataType === this.selectedDataType);
    }
    
    // Apply sorting
    switch (this.selectedSortOption) {
      case 'newest':
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'name_asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'contributions':
        filtered.sort((a, b) => b.contributionCount - a.contributionCount);
        break;
    }
    
    this.totalDatasets = filtered.length;
    
    // Apply pagination
    const startIndex = this.pageIndex * this.pageSize;
    this.filteredDatasets = filtered.slice(startIndex, startIndex + this.pageSize);
  }
  
  // Handle page event from paginator
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.applyFilters();
  }
  
  // Reset all filters
  resetFilters(): void {
    this.searchQuery = '';
    this.selectedDataType = '';
    this.selectedSortOption = 'newest';
    this.pageIndex = 0;
    this.applyFilters();
  }
  
  // Generate mock data for testing
  private generateMockDatasets(count: number): Dataset[] {
    const datasets: Dataset[] = [];
    const dataTypes: Array<'image' | 'text' | 'structured'> = ['image', 'text', 'structured'];
    const visibilityTypes: Array<'public' | 'private' | 'collaborative'> = ['public', 'private', 'collaborative'];
    const tagOptions = [
      'machine-learning', 'deep-learning', 'computer-vision', 'nlp', 'classification', 
      'regression', 'clustering', 'face-recognition', 'object-detection', 'sentiment-analysis',
      'medical', 'finance', 'education', 'social-media', 'research'
    ];
    
    for (let i = 1; i <= count; i++) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 365)); // Random date within the last year
      
      const updatedAt = new Date(createdAt);
      updatedAt.setDate(updatedAt.getDate() + Math.floor(Math.random() * 30)); // Random update date after creation
      
      // Generate 1-3 random tags
      const tags: string[] = [];
      const tagCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < tagCount; j++) {
        const randomTag = tagOptions[Math.floor(Math.random() * tagOptions.length)];
        if (!tags.includes(randomTag)) {
          tags.push(randomTag);
        }
      }
      
      datasets.push({
        id: `ds-${i}`,
        name: `Dataset ${i}`,
        description: `This is a sample dataset #${i} for demonstration purposes. It contains various ${dataTypes[i % 3]} data.`,
        dataType: dataTypes[i % 3],
        visibility: visibilityTypes[i % 3],
        contributionCount: Math.floor(Math.random() * 10000),
        createdAt,
        updatedAt,
        ownerId: `user-${Math.floor(Math.random() * 10) + 1}`,
        ownerName: `User ${Math.floor(Math.random() * 10) + 1}`,
        tags
      });
    }
    
    return datasets;
  }
}
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  // Mock featured datasets
  featuredDatasets = [
    {
      id: '1',
      name: 'Common Objects Dataset',
      description: 'A curated collection of everyday objects with high-quality annotations.',
      dataType: 'image',
      contributionCount: 5280,
      thumbnailUrl: 'assets/images/dataset-thumbnail-1.jpg'
    },
    {
      id: '2',
      name: 'Conversational Text Corpus',
      description: 'Natural language dataset for training conversational AI models.',
      dataType: 'text',
      contributionCount: 12750,
      thumbnailUrl: 'assets/images/dataset-thumbnail-2.jpg'
    },
    {
      id: '3',
      name: 'Financial Time Series',
      description: 'Structured financial data for predictive modeling and analysis.',
      dataType: 'structured',
      contributionCount: 8320,
      thumbnailUrl: 'assets/images/dataset-thumbnail-3.jpg'
    }
  ];
}
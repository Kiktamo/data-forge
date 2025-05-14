import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent {
  // Mock data
  userStats = {
    total: 128,
    active: 112,
    new: 14,
    inactive: 16
  };
  
  datasetStats = {
    total: 32,
    public: 24,
    private: 8,
    collaborative: 16
  };
  
  contributionStats = {
    total: 2450,
    pending: 87,
    approved: 2290,
    rejected: 73
  };

  // User's role badges
  roleBadges = {
    admin: 'Admin can manage the entire system, including users, datasets, and settings.',
    moderator: 'Moderators can validate contributions and manage dataset contents.',
    contributor: 'Contributors can create and contribute to datasets.',
    viewer: 'Viewers can access and download public datasets.'
  };
  
  // Tables data
  recentUsers = [
    { id: 'u-1', username: 'newuser1', email: 'user1@example.com', date: new Date(), role: 'contributor' },
    { id: 'u-2', username: 'newuser2', email: 'user2@example.com', date: new Date(Date.now() - 86400000), role: 'viewer' },
    { id: 'u-3', username: 'newuser3', email: 'user3@example.com', date: new Date(Date.now() - 172800000), role: 'contributor' },
    { id: 'u-4', username: 'newuser4', email: 'user4@example.com', date: new Date(Date.now() - 259200000), role: 'moderator' }
  ];
  
  recentDatasets = [
    { id: 'ds-1', name: 'New Dataset 1', owner: 'user1', date: new Date(), type: 'image', visibility: 'public' },
    { id: 'ds-2', name: 'New Dataset 2', owner: 'user2', date: new Date(Date.now() - 86400000), type: 'text', visibility: 'private' },
    { id: 'ds-3', name: 'New Dataset 3', owner: 'user3', date: new Date(Date.now() - 172800000), type: 'structured', visibility: 'collaborative' },
    { id: 'ds-4', name: 'New Dataset 4', owner: 'user4', date: new Date(Date.now() - 259200000), type: 'image', visibility: 'public' }
  ];
  
  // Display columns for tables
  userColumns = ['username', 'email', 'date', 'role', 'actions'];
  datasetColumns = ['name', 'owner', 'date', 'type', 'visibility', 'actions'];
  
  constructor(public authService: AuthService) {}
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'admin':
      case 'moderator':
        return 'status-admin';
      case 'contributor':
        return 'status-contributor';
      case 'viewer':
      default:
        return 'status-viewer';
    }
  }
  
  getTypeIcon(type: string): string {
    switch (type) {
      case 'image':
        return 'image';
      case 'text':
        return 'text_fields';
      case 'structured':
        return 'table_chart';
      default:
        return 'dataset';
    }
  }
}
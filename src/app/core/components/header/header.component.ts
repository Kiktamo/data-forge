
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { BehaviorSubject } from 'rxjs';

// Mock auth service for now - this will be implemented later
const mockAuthService = {
  isAuthenticated: () => false,
  currentUser: null
};

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  // Mock auth service - will be replaced with actual service in future
  protected auth = mockAuthService;
  
  // Mobile menu state
  isMenuOpen = new BehaviorSubject<boolean>(false);
  
  toggleMenu() {
    this.isMenuOpen.next(!this.isMenuOpen.value);
  }
}
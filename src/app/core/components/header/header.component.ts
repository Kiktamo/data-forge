import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BehaviorSubject, Subject, takeUntil, filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

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
    MatSidenavModule,
    MatSnackBarModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // User state
  currentUser: User | null = null;
  
  // Mobile menu state
  isMenuOpen = new BehaviorSubject<boolean>(false);
  
  constructor(
    public authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    // Subscribe to auth state changes
    this.authService.currentUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUser = user;
      
      // FIXED: Close mobile menu when user logs out
      if (!user && this.isMenuOpen.value) {
        this.isMenuOpen.next(false);
      }
    });
  }
  
  ngOnInit(): void {
    // FIXED: Close mobile menu on route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (this.isMenuOpen.value) {
        this.isMenuOpen.next(false);
      }
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  toggleMenu(): void {
    this.isMenuOpen.next(!this.isMenuOpen.value);
  }
  
  closeMenu(): void {
    this.isMenuOpen.next(false);
  }
  
  logout(): void {
    // FIXED: Close mobile menu first, then logout
    this.closeMenu();
    
    this.authService.logout().subscribe({
      next: () => {
        this.snackBar.open('You have been logged out', 'Close', {
          duration: 3000
        });
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.snackBar.open(`Logout error: ${error.message}`, 'Close', {
          duration: 5000
        });
      }
    });
  }
  
  // FIXED: Navigate and close menu
  navigateAndCloseMenu(route: string): void {
    this.closeMenu();
    this.router.navigate([route]);
  }
}
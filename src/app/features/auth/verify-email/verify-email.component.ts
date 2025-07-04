import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent implements OnInit {
  isVerifying = true;
  verificationSuccess = false;
  errorMessage = '';
  isLoggedIn = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isAuthenticated();
    
    // Get token from query params
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      
      if (token) {
        this.verifyEmail(token);
      } else {
        this.isVerifying = false;
        this.errorMessage = 'No verification token provided in the URL.';
      }
    });
  }

  private verifyEmail(token: string): void {
    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.isVerifying = false;
        this.verificationSuccess = true;
        this.snackBar.open('Email verified successfully!', 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
      },
      error: (error) => {
        this.isVerifying = false;
        this.verificationSuccess = false;
        this.errorMessage = error.message || 'Failed to verify email address.';
        this.snackBar.open(`Verification failed: ${error.message}`, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }
}
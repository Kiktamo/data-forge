import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatStepperModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  requestForm: FormGroup;
  resetForm: FormGroup;
  
  isRequestingReset = false;
  isResettingPassword = false;
  hidePassword = true;
  hideConfirmPassword = true;
  
  resetToken: string | null = null;
  requestSent = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    // Initialize forms
    this.requestForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetForm = this.fb.group({
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-zA-Z])(?=.*\d).+$/) // At least one letter and one number
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Check if token is provided in URL for direct reset
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.resetToken = params['token'];
      }
    });
  }

  onRequestReset(): void {
    if (this.requestForm.valid) {
      this.isRequestingReset = true;
      const { email } = this.requestForm.value;
      
      this.authService.requestPasswordReset(email).subscribe({
        next: () => {
          this.isRequestingReset = false;
          this.requestSent = true;
        },
        error: (error) => {
          this.isRequestingReset = false;
          this.snackBar.open(`Error: ${error.message}`, 'Close', {
            duration: 5000
          });
        }
      });
    } else {
      // Mark form controls as touched to show validation errors
      this.requestForm.markAllAsTouched();
    }
  }

  onResetPassword(): void {
    if (this.resetForm.valid && this.resetToken) {
      this.isResettingPassword = true;
      const { newPassword } = this.resetForm.value;
      
      this.authService.resetPassword(this.resetToken, newPassword).subscribe({
        next: () => {
          this.isResettingPassword = false;
          this.snackBar.open('Password reset successfully. You can now log in with your new password.', 'Close', {
            duration: 5000
          });
          this.router.navigate(['/auth/login']);
        },
        error: (error) => {
          this.isResettingPassword = false;
          this.snackBar.open(`Error: ${error.message}`, 'Close', {
            duration: 5000
          });
        }
      });
    } else {
      // Mark form controls as touched to show validation errors
      this.resetForm.markAllAsTouched();
    }
  }

  // Custom validator to check if passwords match
  passwordMatchValidator(group: FormGroup): {[key: string]: any} | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    return newPassword === confirmPassword ? null : { 'passwordMismatch': true };
  }

  // Helper getters for template
  get email() { return this.requestForm.get('email'); }
  get newPassword() { return this.resetForm.get('newPassword'); }
  get confirmPassword() { return this.resetForm.get('confirmPassword'); }
  
  // Check if passwords match for template
  get passwordsMatch(): boolean {
    return this.resetForm.get('newPassword')?.value === this.resetForm.get('confirmPassword')?.value;
  }
}
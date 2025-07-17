import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatStepperModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  accountForm: FormGroup;
  profileForm: FormGroup;
  isLoading = false;
  hidePassword = true;
  hideConfirmPassword = true;
  
  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    // First step - account information
    this.accountForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20), Validators.pattern('^[a-zA-Z0-9_-]*$')]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
    
    // Second step - profile information
    this.profileForm = this.fb.group({
      fullName: ['', Validators.required],
      bio: [''],
      acceptTerms: [false, Validators.requiredTrue]
    });
  }
  
  // Custom validator to check if password and confirm password match
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
  
  onSubmit(): void {
    if (this.accountForm.valid && this.profileForm.valid) {
      this.isLoading = true;
      
      // Combine both forms
      const registrationData = {
        ...this.accountForm.value,
        ...this.profileForm.value
      };
      
      // Remove confirmPassword field
      delete registrationData.confirmPassword;
      
      this.authService.register(registrationData.username, registrationData.email, registrationData.password, registrationData.fullName, registrationData?.bio).subscribe(
        response => { console.log('Registration successful', response); this.isLoading = false; this.router.navigate(['/']); },
        error => { console.error('Registration failed', error); this.isLoading = false; });
    } else {
      // Mark all form controls as touched to trigger validation messages
      Object.keys(this.accountForm.controls).forEach(key => {
        const control = this.accountForm.get(key);
        control?.markAsTouched();
      });
      
      Object.keys(this.profileForm.controls).forEach(key => {
        const control = this.profileForm.get(key);
        control?.markAsTouched();
      });
    }
  }
  
  // Helper methods for template
  get email() { return this.accountForm.get('email'); }
  get username() { return this.accountForm.get('username'); }
  get password() { return this.accountForm.get('password'); }
  get confirmPassword() { return this.accountForm.get('confirmPassword'); }
  get fullName() { return this.profileForm.get('fullName'); }
  get acceptTerms() { return this.profileForm.get('acceptTerms'); }
  
  // Check if passwords match for template
  get passwordsMatch(): boolean {
    return this.accountForm.get('password')?.value === this.accountForm.get('confirmPassword')?.value;
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environments';
import { User } from '../models/user.model';
import { JwtHelperService } from '../utils/jwt-helper.service';

interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private refreshTokenTimeout: any;

  constructor(
    private http: HttpClient,
    private router: Router,
    private jwtHelper: JwtHelperService
  ) {
    // Initialize user from local storage
    this.loadUserFromStorage();
  }

  // Observable for current user state
  public currentUser$ = this.currentUserSubject.asObservable();

  // Getter for current user value
  public get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Check if user is authenticated
  public isAuthenticated(): boolean {
    const accessToken = localStorage.getItem('accessToken');
    return !!accessToken && !this.jwtHelper.isTokenExpired(accessToken);
  }

  // Check if user has a specific role
  public hasRole(role: string): boolean {
    const user = this.currentUser;
    return !!user && !!user.roles && user.roles.includes(role);
  }

  // Register new user
  public register(
    username: string,
    email: string,
    password: string,
    fullName?: string,
    bio?: string
  ): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, {
        username,
        email,
        password,
        fullName,
        bio,
      })
      .pipe(
        map((response) => {
          if (
            response.success &&
            response.user &&
            response.accessToken &&
            response.refreshToken
          ) {
            this.setSession(
              response.user,
              response.accessToken,
              response.refreshToken
            );
            return response.user;
          } else {
            throw new Error(response.message || 'Registration failed');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Login user
  public login(email: string, password: string): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, {
        email,
        password,
      })
      .pipe(
        map((response) => {
          if (
            response.success &&
            response.user &&
            response.accessToken &&
            response.refreshToken
          ) {
            this.setSession(
              response.user,
              response.accessToken,
              response.refreshToken
            );
            return response.user;
          } else {
            throw new Error(response.message || 'Login failed');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Logout user
  // Logout user
  public logout(): Observable<void> {
    // Clear session first to prevent any UI issues
    const wasAuthenticated = this.isAuthenticated();

    if (wasAuthenticated) {
      return this.http.post<AuthResponse>(`${this.apiUrl}/logout`, {}).pipe(
        tap(() => {
          this.clearSession();
        }),
        map(() => void 0),
        catchError((error) => {
          // Clear session even if logout request fails
          this.clearSession();
          return throwError(() => error);
        })
      );
    } else {
      // Just clear the session without making a request
      this.clearSession();
      return new Observable((subscriber) => {
        subscriber.next();
        subscriber.complete();
      });
    }
  }

  // Refresh access token
  public refreshToken(): Observable<string> {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http
      .post<AuthResponse>(`${this.apiUrl}/refresh-token`, {
        refreshToken,
      })
      .pipe(
        map((response) => {
          if (
            response.success &&
            response.accessToken &&
            response.refreshToken
          ) {
            localStorage.setItem('accessToken', response.accessToken);
            localStorage.setItem('refreshToken', response.refreshToken);
            this.startRefreshTokenTimer();
            return response.accessToken;
          } else {
            throw new Error(response.message || 'Token refresh failed');
          }
        }),
        catchError((error) => {
          this.clearSession();
          return throwError(() => error);
        })
      );
  }

  // Get user profile
  public getProfile(): Observable<User> {
    return this.http.get<AuthResponse>(`${this.apiUrl}/profile`).pipe(
      map((response) => {
        if (response.success && response.user) {
          this.currentUserSubject.next(response.user);
          return response.user;
        } else {
          throw new Error(response.message || 'Failed to fetch profile');
        }
      }),
      catchError(this.handleError)
    );
  }

  // Update user profile
  public updateProfile(profileData: Partial<User>): Observable<User> {
    return this.http
      .put<AuthResponse>(`${this.apiUrl}/profile`, profileData)
      .pipe(
        map((response) => {
          if (response.success && response.user) {
            this.updateStoredUser(response.user);
            return response.user;
          } else {
            throw new Error(response.message || 'Failed to update profile');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Change password
  public changePassword(
    currentPassword: string,
    newPassword: string
  ): Observable<void> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/change-password`, {
        currentPassword,
        newPassword,
      })
      .pipe(
        map((response) => {
          if (
            response.success &&
            response.accessToken &&
            response.refreshToken
          ) {
            localStorage.setItem('accessToken', response.accessToken);
            localStorage.setItem('refreshToken', response.refreshToken);
            this.startRefreshTokenTimer();
            return void 0;
          } else {
            throw new Error(response.message || 'Failed to change password');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Request password reset
  public requestPasswordReset(email: string): Observable<void> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/request-password-reset`, {
        email,
      })
      .pipe(
        map((response) => {
          if (response.success) {
            return void 0;
          } else {
            throw new Error(
              response.message || 'Failed to request password reset'
            );
          }
        }),
        catchError(this.handleError)
      );
  }

  // Reset password with token
  public resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/reset-password`, {
        token,
        newPassword,
      })
      .pipe(
        map((response) => {
          if (response.success) {
            return void 0;
          } else {
            throw new Error(response.message || 'Failed to reset password');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Resend email verification
  public resendEmailVerification(): Observable<void> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/resend-verification`, {})
      .pipe(
        map((response) => {
          if (response.success) {
            return void 0;
          } else {
            throw new Error(
              response.message || 'Failed to resend verification email'
            );
          }
        }),
        catchError(this.handleError)
      );
  }

  // Verify email
  public verifyEmail(token: string): Observable<void> {
    return this.http
      .get<AuthResponse>(`${this.apiUrl}/verify-email?token=${token}`)
      .pipe(
        map((response) => {
          if (response.success) {
            // If user is logged in, update their verified status
            if (this.currentUser) {
              const updatedUser = { ...this.currentUser, emailVerified: true };
              this.updateStoredUser(updatedUser);
            }
            return void 0;
          } else {
            throw new Error(response.message || 'Failed to verify email');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Private helper methods
  private setSession(
    user: User,
    accessToken: string,
    refreshToken: string
  ): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    this.currentUserSubject.next(user);
    this.startRefreshTokenTimer();
  }

  private clearSession(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    this.currentUserSubject.next(null);
    this.stopRefreshTokenTimer();

    // Only navigate if not already on a public page
    const currentUrl = this.router.url;
    const publicRoutes = ['/', '/auth/login', '/auth/register', '/datasets'];

    if (!publicRoutes.some((route) => currentUrl.startsWith(route))) {
      this.router.navigate(['/']);
    }
  }

  private updateStoredUser(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem('currentUser');
    const accessToken = localStorage.getItem('accessToken');

    if (userStr && accessToken) {
      try {
        const user = JSON.parse(userStr);

        // Check if token is valid
        if (!this.jwtHelper.isTokenExpired(accessToken)) {
          this.currentUserSubject.next(user);
          this.startRefreshTokenTimer();
        } else {
          // If token is expired, try to refresh
          this.refreshToken().subscribe({
            error: () => this.clearSession(),
          });
        }
      } catch (e) {
        this.clearSession();
      }
    }
  }

  private startRefreshTokenTimer(): void {
    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
      return;
    }

    // Stop any existing timer
    this.stopRefreshTokenTimer();

    // Calculate when token will expire
    const expiresAt = this.jwtHelper.getTokenExpirationDate(accessToken);

    if (!expiresAt) {
      return;
    }

    // Set refresh timer to 30 seconds before token expires
    const timeout = expiresAt.getTime() - Date.now() - 30 * 1000;
    this.refreshTokenTimeout = setTimeout(() => {
      this.refreshToken().subscribe();
    }, Math.max(0, timeout));
  }

  private stopRefreshTokenTimer(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.error?.message) {
      // Server error with message
      errorMessage = error.error.message;
    } else if (error.status) {
      // Other server errors
      switch (error.status) {
        case 400:
          errorMessage = 'Bad Request';
          break;
        case 401:
          errorMessage = 'Unauthorized';
          break;
        case 403:
          errorMessage = 'Forbidden';
          break;
        case 404:
          errorMessage = 'Not Found';
          break;
        case 500:
          errorMessage = 'Internal Server Error';
          break;
        default:
          errorMessage = `Error Code: ${error.status}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}

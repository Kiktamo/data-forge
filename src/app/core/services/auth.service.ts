import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  constructor(private http: HttpClient) {
    // Check localStorage for existing user session
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }
  
  login(email: string, password: string): Observable<User> {
    return this.http.post<User>('/api/auth/login', { email, password })
      .pipe(
        tap(user => {
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
        })
      );
  }
  
  register(userData: Partial<User>): Observable<User> {
    return this.http.post<User>('/api/auth/register', userData);
  }
  
  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.http.post('/api/auth/logout', {}).subscribe();
  }
  
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }
  
  isAuthenticated(): boolean {
    return !!this.currentUser;
  }
}
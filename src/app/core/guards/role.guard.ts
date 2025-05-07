import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // First check if the user is authenticated
    if (!this.authService.isAuthenticated()) {
      return this.router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
    }

    // Get the required roles from the route data
    const requiredRoles = route.data['roles'] as string[];
    
    // If no roles specified, just require authentication
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    
    // Check if the user has at least one of the required roles
    const hasRequiredRole = requiredRoles.some(role => this.authService.hasRole(role));
    
    if (hasRequiredRole) {
      return true;
    }
    
    // If the user doesn't have the required roles, redirect to unauthorized page
    return this.router.createUrlTree(['/unauthorized']);
  }
}
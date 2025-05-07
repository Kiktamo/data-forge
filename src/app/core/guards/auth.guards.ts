import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, CanLoad, Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild, CanLoad {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.checkAuth(state.url, route);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.checkAuth(state.url, childRoute);
  }

  canLoad(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.checkAuth();
  }

  private checkAuth(url?: string, route?: ActivatedRouteSnapshot): boolean | UrlTree {
    // Check if the user is authenticated
    if (this.authService.isAuthenticated()) {
      // Check if the route requires specific roles
      if (route?.data?.['roles']) {
        const requiredRoles = route.data['roles'] as string[];
        
        // Check if the user has at least one of the required roles
        const hasRequiredRole = requiredRoles.some(role => this.authService.hasRole(role));
        
        if (!hasRequiredRole) {
          // If user doesn't have required roles, redirect to unauthorized page
          return this.router.createUrlTree(['/unauthorized']);
        }
      }
      
      // User is authenticated and has required roles (if any)
      return true;
    }
    
    // User is not authenticated, redirect to login page
    return this.router.createUrlTree(['/auth/login'], {
      queryParams: url ? { returnUrl: url } : {}
    });
  }
}
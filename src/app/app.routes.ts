import { Routes } from '@angular/router';

export const routes: Routes = [
    { 
      path: '', 
      pathMatch: 'full',
      loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
    },
    { 
      path: 'auth', 
      children: [
        { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
        { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) }
      ]
    },
    { 
      path: 'datasets', 
      children: [
        { path: '', loadComponent: () => import('./features/datasets/dataset-list/dataset-list.component').then(m => m.DatasetListComponent) },
        { path: 'new', loadComponent: () => import('./features/datasets/dataset-create/dataset-create.component').then(m => m.DatasetCreateComponent) },
        { path: ':id', loadComponent: () => import('./features/datasets/dataset-detail/dataset-detail.component').then(m => m.DatasetDetailComponent) },
        { path: ':id/edit', loadComponent: () => import('./features/datasets/dataset-edit/dataset-edit.component').then(m => m.DatasetEditComponent) },
        { path: ':id/contribute', loadComponent: () => import('./features/contributions/contribution-create/contribution-create.component').then(m => m.ContributionCreateComponent) }
      ]
    },
    { 
      path: 'profile', 
      loadComponent: () => import('./features/auth/profile/profile.component').then(m => m.ProfileComponent) 
    },
    { 
      path: '**', 
      loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent) 
    }
  ];
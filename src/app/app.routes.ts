import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

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
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
      { 
        path: 'profile', 
        loadComponent: () => import('./features/auth/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [AuthGuard]
      }
    ]
  },
  { 
    path: 'datasets', 
    children: [
      { path: '', loadComponent: () => import('./features/datasets/dataset-list/dataset-list.component').then(m => m.DatasetListComponent) },
      { 
        path: 'new', 
        loadComponent: () => import('./features/datasets/dataset-create/dataset-create.component').then(m => m.DatasetCreateComponent),
        canActivate: [AuthGuard]
      },
      { path: ':id', loadComponent: () => import('./features/datasets/dataset-detail/dataset-detail.component').then(m => m.DatasetDetailComponent) },
      { 
        path: ':id/edit', 
        loadComponent: () => import('./features/datasets/dataset-edit/dataset-edit.component').then(m => m.DatasetEditComponent),
        canActivate: [AuthGuard]
      },
      { 
        path: ':id/contribute', 
        loadComponent: () => import('./features/contributions/contribution-create/contribution-create.component').then(m => m.ContributionCreateComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'my',
        loadComponent: () => import('./features/datasets/dataset-list/dataset-list.component').then(m => m.DatasetListComponent),
        canActivate: [AuthGuard],
        data: { myDatasets: true }
      }
    ]
  },
  { 
    path: 'contributions', 
    children: [
      { 
        path: '',
        loadComponent: () => import('./features/contributions/contribution-list/contribution-list.component').then(m => m.ContributionListComponent),
        canActivate: [AuthGuard]
      },
      {
        path: ':id',
        loadComponent: () => import('./features/contributions/contribution-detail/contribution-detail.component').then(m => m.ContributionDetailComponent),
        canActivate: [AuthGuard]
      }
    ]
  },
  {
    path: 'validate',
    loadComponent: () => import('./features/validation/validation-queue/validation-queue.component').then(m => m.ValidationQueueComponent),
    canActivate: [AuthGuard]
  },
  // { 
  //   path: 'explore', 
  //   loadComponent: () => import('./features/explore/explore.component').then(m => m.ExploreComponent) 
  // },
  // { 
  //   path: 'docs', 
  //   loadComponent: () => import('./features/docs/docs.component').then(m => m.DocsComponent) 
  // },
  { 
    path: 'admin', 
    loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [RoleGuard],
    data: { roles: ['admin'] }
  },
  { 
    path: 'unauthorized', 
    loadComponent: () => import('./features/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent) 
  },
  // { 
  //   path: 'terms', 
  //   loadComponent: () => import('./features/legal/terms/terms.component').then(m => m.TermsComponent) 
  // },
  // { 
  //   path: 'privacy', 
  //   loadComponent: () => import('./features/legal/privacy/privacy.component').then(m => m.PrivacyComponent) 
  // },
  // { 
  //   path: 'contact', 
  //   loadComponent: () => import('./features/contact/contact.component').then(m => m.ContactComponent) 
  // },
  // { 
  //   path: 'about', 
  //   loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent) 
  // },
  { 
    path: '**', 
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent) 
  }
];
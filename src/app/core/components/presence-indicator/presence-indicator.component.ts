import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';

import { WebSocketService, User, DatasetPresence } from '../../services/web-socket.service';

@Component({
  selector: 'app-presence-indicator',
  standalone: true,
  imports: [
    CommonModule,
    MatTooltipModule,
    MatIconModule,
    MatBadgeModule,
    MatChipsModule
  ],
  template: `
    <div class="presence-indicator" *ngIf="datasetId">
      <!-- Viewers -->
      <div class="presence-group viewers" *ngIf="viewers.length > 0">
        <div class="user-avatars">
          <div 
            *ngFor="let user of viewers.slice(0, 3); let i = index" 
            class="user-avatar viewer"
            [matTooltip]="getUserDisplayName(user) + ' is viewing'"
            [style.z-index]="10 - i"
          >
            <span class="avatar-text">{{ getInitials(user) }}</span>
          </div>
          <div 
            *ngIf="viewers.length > 3" 
            class="user-avatar overflow"
            [matTooltip]="'And ' + (viewers.length - 3) + ' more viewers'"
          >
            <span class="avatar-text">+{{ viewers.length - 3 }}</span>
          </div>
        </div>
        <span class="presence-label">
          {{ viewers.length === 1 ? '1 viewer' : viewers.length + ' viewers' }}
        </span>
      </div>

      <!-- Editors -->
      <div class="presence-group editors" *ngIf="editors.length > 0">
        <div class="user-avatars">
          <div 
            *ngFor="let user of editors.slice(0, 2); let i = index" 
            class="user-avatar editor"
            [matTooltip]="getUserDisplayName(user) + ' is editing'"
            [style.z-index]="10 - i"
          >
            <mat-icon class="editing-icon">edit</mat-icon>
            <span class="avatar-text">{{ getInitials(user) }}</span>
          </div>
          <div 
            *ngIf="editors.length > 2" 
            class="user-avatar overflow"
            [matTooltip]="'And ' + (editors.length - 2) + ' more editors'"
          >
            <span class="avatar-text">+{{ editors.length - 2 }}</span>
          </div>
        </div>
        <span class="presence-label editing">
          {{ editors.length === 1 ? '1 editing' : editors.length + ' editing' }}
        </span>
      </div>

      <!-- Connection status -->
      <div class="connection-status" [class.connected]="isConnected" [class.disconnected]="!isConnected">
        <mat-icon [matTooltip]="isConnected ? 'Connected' : 'Disconnected'">
          {{ isConnected ? 'wifi' : 'wifi_off' }}
        </mat-icon>
      </div>
    </div>
  `,
  styles: [`
    .presence-indicator {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
      min-height: 48px;

      .presence-group {
        display: flex;
        align-items: center;
        gap: 8px;

        .user-avatars {
          display: flex;
          margin-right: 8px;

          .user-avatar {
            position: relative;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 600;
            color: white;
            margin-left: -4px;
            border: 2px solid white;
            cursor: pointer;
            transition: transform 0.2s ease;

            &:hover {
              transform: scale(1.1);
            }

            &:first-child {
              margin-left: 0;
            }

            &.viewer {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }

            &.editor {
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              animation: pulse 2s infinite;
            }

            &.overflow {
              background: #6c757d;
              font-size: 0.7rem;
            }

            .editing-icon {
              position: absolute;
              top: -2px;
              right: -2px;
              width: 14px;
              height: 14px;
              font-size: 14px;
              background: #ff4444;
              border-radius: 50%;
              padding: 1px;
            }

            .avatar-text {
              z-index: 1;
            }
          }
        }

        .presence-label {
          font-size: 0.85rem;
          color: #666;
          font-weight: 500;

          &.editing {
            color: #f5576c;
          }
        }
      }

      .connection-status {
        margin-left: auto;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #ccc;
        }

        &.connected mat-icon {
          color: #28a745;
        }

        &.disconnected mat-icon {
          color: #dc3545;
        }
      }
    }

    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(245, 87, 108, 0.7);
      }
      70% {
        box-shadow: 0 0 0 8px rgba(245, 87, 108, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(245, 87, 108, 0);
      }
    }

    // Dark theme
    .dark-theme .presence-indicator {
      background: #424242;
      border-color: #616161;

      .presence-group .presence-label {
        color: #ccc;

        &.editing {
          color: #ff7b7b;
        }
      }
    }

    // Mobile responsive
    @media (max-width: 768px) {
      .presence-indicator {
        gap: 12px;
        padding: 6px;

        .presence-group {
          .user-avatars .user-avatar {
            width: 28px;
            height: 28px;
            font-size: 0.7rem;
          }

          .presence-label {
            font-size: 0.8rem;
          }
        }
      }
    }
  `]
})
export class PresenceIndicatorComponent implements OnInit, OnDestroy {
  @Input() datasetId: number | null = null;
  
  private destroy$ = new Subject<void>();
  
  viewers: User[] = [];
  editors: User[] = [];
  isConnected = false;
  
  constructor(private wsService: WebSocketService) {}
  
  ngOnInit(): void {
    // Subscribe to connection status
    this.wsService.connected$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(connected => {
      this.isConnected = connected;
    });
    
    // Subscribe to dataset presence updates
    this.wsService.datasetPresence$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(presenceMap => {
      if (this.datasetId) {
        const presence = presenceMap.get(this.datasetId);
        if (presence) {
          this.viewers = presence.viewers;
          this.editors = presence.editors;
        } else {
          this.viewers = [];
          this.editors = [];
        }
      }
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  getUserDisplayName(user: User): string {
    return user.fullName || user.username || 'Unknown User';
  }
  
  getInitials(user: User): string {
    const name = this.getUserDisplayName(user);
    return name.split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }
}
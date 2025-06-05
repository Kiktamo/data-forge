import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environments';
import { AuthService } from './auth.service';

export interface User {
  id: number;
  username: string;
  fullName?: string;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface DatasetPresence {
  viewers: User[];
  editors: User[];
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private isConnecting = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  // Connection state
  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();
  
  // Message streams
  private messageSubject = new Subject<WebSocketMessage>();
  public messages$ = this.messageSubject.asObservable();
  
  // Dataset presence tracking
  private datasetPresenceSubject = new BehaviorSubject<Map<number, DatasetPresence>>(new Map());
  public datasetPresence$ = this.datasetPresenceSubject.asObservable();
  
  // Current user's state
  private currentDataset: number | null = null;
  private isEditing = false;
  
  constructor(private authService: AuthService) {
    // Auto-connect when user is authenticated
    this.authService.currentUser$.subscribe(user => {
      if (user && !this.ws) {
        this.connect();
      } else if (!user && this.ws) {
        this.disconnect();
      }
    });
  }
  
  ngOnDestroy(): void {
    this.disconnect();
  }
  
  // Connection management
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.log('No access token available for WebSocket connection');
      return;
    }
    
    this.isConnecting = true;
    const wsUrl = `${environment.wsUrl}/ws?token=${encodeURIComponent(token)}`;
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleConnectionError();
    }
  }
  
  disconnect(): void {
    this.shouldReconnect = false;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connectedSubject.next(false);
    this.isConnecting = false;
  }
  
  private setupEventListeners(): void {
    if (!this.ws) return;
    
    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.connectedSubject.next(true);
      this.startPingTimer();
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      this.connectedSubject.next(false);
      this.clearTimers();
      this.ws = null;
      
      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.handleConnectionError();
    };
  }
  
  private handleMessage(message: WebSocketMessage): void {
    console.log('📨 WebSocket message:', message.type);
    
    // Emit to message stream
    this.messageSubject.next(message);
    
    // Handle specific message types
    switch (message.type) {
      case 'dataset-status':
        this.updateDatasetPresence(message['datasetId'], {
          viewers: message['viewers'] || [],
          editors: message['editors'] || []
        });
        break;
        
      case 'user-joined':
        this.handleUserJoined(message);
        break;
        
      case 'user-left':
        this.handleUserLeft(message);
        break;
        
      case 'user-started-editing':
        this.handleUserStartedEditing(message);
        break;
        
      case 'user-stopped-editing':
        this.handleUserStoppedEditing(message);
        break;
        
      case 'dataset-updated':
        // Handle real-time dataset updates
        break;
        
      case 'pong':
        // Ping response received
        break;
    }
  }
  
  private handleUserJoined(message: any): void {
    const currentPresence = this.datasetPresenceSubject.value;
    const datasetPresence = currentPresence.get(message.datasetId) || { viewers: [], editors: [] };
    
    // Add user to viewers if not already present
    if (!datasetPresence.viewers.find(u => u.id === message.user.id)) {
      datasetPresence.viewers.push(message.user);
    }
    
    this.updateDatasetPresence(message.datasetId, datasetPresence);
  }
  
  private handleUserLeft(message: any): void {
    const currentPresence = this.datasetPresenceSubject.value;
    const datasetPresence = currentPresence.get(message.datasetId) || { viewers: [], editors: [] };
    
    // Remove user from viewers and editors
    datasetPresence.viewers = datasetPresence.viewers.filter(u => u.id !== message.user.id);
    datasetPresence.editors = datasetPresence.editors.filter(u => u.id !== message.user.id);
    
    this.updateDatasetPresence(message.datasetId, datasetPresence);
  }
  
  private handleUserStartedEditing(message: any): void {
    const currentPresence = this.datasetPresenceSubject.value;
    const datasetPresence = currentPresence.get(message.datasetId) || { viewers: [], editors: [] };
    
    // Add user to editors if not already present
    if (!datasetPresence.editors.find(u => u.id === message.user.id)) {
      datasetPresence.editors.push(message.user);
    }
    
    this.updateDatasetPresence(message.datasetId, datasetPresence);
  }
  
  private handleUserStoppedEditing(message: any): void {
    const currentPresence = this.datasetPresenceSubject.value;
    const datasetPresence = currentPresence.get(message.datasetId) || { viewers: [], editors: [] };
    
    // Remove user from editors
    datasetPresence.editors = datasetPresence.editors.filter(u => u.id !== message.user.id);
    
    this.updateDatasetPresence(message.datasetId, datasetPresence);
  }
  
  private updateDatasetPresence(datasetId: number, presence: DatasetPresence): void {
    const currentPresence = this.datasetPresenceSubject.value;
    currentPresence.set(datasetId, presence);
    this.datasetPresenceSubject.next(new Map(currentPresence));
  }
  
  private handleConnectionError(): void {
    this.isConnecting = false;
    this.connectedSubject.next(false);
    
    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`🔄 Scheduling WebSocket reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }
  
  private startPingTimer(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }
  
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
  
  // Public API methods
  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }
  
  // Dataset presence methods
  joinDataset(datasetId: number): void {
    this.currentDataset = datasetId;
    this.send({
      type: 'join-dataset',
      datasetId
    });
  }
  
  leaveDataset(): void {
    if (this.currentDataset) {
      this.send({
        type: 'leave-dataset',
        datasetId: this.currentDataset
      });
      
      this.currentDataset = null;
      this.isEditing = false;
    }
  }
  
  startEditing(datasetId: number): void {
    this.isEditing = true;
    this.send({
      type: 'start-editing',
      datasetId
    });
  }
  
  stopEditing(): void {
    if (this.currentDataset && this.isEditing) {
      this.isEditing = false;
      this.send({
        type: 'stop-editing',
        datasetId: this.currentDataset
      });
    }
  }
  
  notifyDatasetUpdate(datasetId: number, updateData: any): void {
    this.send({
      type: 'dataset-update',
      datasetId,
      data: updateData
    });
  }
  
  // Getter methods
  getDatasetPresence(datasetId: number): DatasetPresence | null {
    return this.datasetPresenceSubject.value.get(datasetId) || null;
  }
  
  getCurrentDataset(): number | null {
    return this.currentDataset;
  }
  
  isCurrentlyEditing(): boolean {
    return this.isEditing;
  }
  
  isConnected(): boolean {
    return this.connectedSubject.value;
  }
  
  // Observable getters for specific message types
  getUserJoinedMessages(): Observable<WebSocketMessage> {
    return this.messages$.pipe();
  }
  
  getDatasetUpdateMessages(): Observable<WebSocketMessage> {
    return this.messages$.pipe();
  }
}
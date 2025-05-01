export interface Dataset {
    id: string;
    name: string;
    description: string;
    ownerId: string;
    visibility: 'public' | 'private' | 'collaborative';
    dataType: 'image' | 'text' | 'structured';
    version: string;
    contributionCount: number;
    validationStatus: 'draft' | 'in_progress' | 'completed';
    createdAt: Date;
    updatedAt: Date;
  }
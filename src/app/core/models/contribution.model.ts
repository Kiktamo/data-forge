export interface Contribution {
    id: string;
    datasetId: string;
    contributorId: string;
    content: any; // This will vary based on data type
    metadata: any;
    validationStatus: 'pending' | 'approved' | 'rejected';
    validatedBy?: string[];
    createdAt: Date;
    updatedAt: Date;
  }
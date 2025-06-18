export interface Validation {
    id: string;
    contributionId: string;
    validatorId: string;
    status: 'approved' | 'rejected';
    comment?: string;
    created_at: Date;
  }
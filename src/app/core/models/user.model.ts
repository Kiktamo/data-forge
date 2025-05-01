export interface User {
    id: string;
    username: string;
    email: string;
    fullName?: string;
    bio?: string;
    profileImage?: string;
    roles: string[];
    createdAt: Date;
    updatedAt: Date;
  }
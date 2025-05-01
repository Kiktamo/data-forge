export const API_ENDPOINTS = {
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      LOGOUT: '/api/auth/logout',
      PROFILE: '/api/auth/profile'
    },
    USERS: {
      BASE: '/api/users',
      BY_ID: (id: string) => `/api/users/${id}`
    },
    DATASETS: {
      BASE: '/api/datasets',
      BY_ID: (id: string) => `/api/datasets/${id}`,
      VERSIONS: (id: string) => `/api/datasets/${id}/versions`,
      EXPORT: (id: string, format: string) => `/api/datasets/${id}/export/${format}`
    },
    CONTRIBUTIONS: {
      BASE: '/api/contributions',
      BY_ID: (id: string) => `/api/contributions/${id}`,
      BY_DATASET: (datasetId: string) => `/api/datasets/${datasetId}/contributions`,
      VALIDATE: (id: string) => `/api/contributions/${id}/validate`
    },
    VALIDATION: {
      BY_CONTRIBUTION: (contributionId: string) => `/api/contributions/${contributionId}/validations`
    },
    STATS: {
      DATASET: (id: string) => `/api/stats/dataset/${id}`,
      USER: (id: string) => `/api/stats/user/${id}`
    }
  };
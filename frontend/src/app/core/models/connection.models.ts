export type DatabaseProvider = 'SqlServer' | 'PostgreSQL' | 'MySQL';

export interface DatabaseConnection {
  id:          string;
  tenantId:    string;
  name:        string;
  description: string;
  provider:    DatabaseProvider;
  status:      'Active' | 'Inactive' | 'Error';
  lastTestedAt: string | null;
  createdAt:   string;
}

export interface CreateConnectionRequest {
  name:             string;
  description:      string;
  provider:         DatabaseProvider;
  connectionString: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

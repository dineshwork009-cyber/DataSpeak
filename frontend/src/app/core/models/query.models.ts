export interface QueryRequest {
  connectionId:          string;
  naturalLanguageQuery:  string;
}

export interface QueryResponse {
  queryId:          string;
  generatedSql:     string;
  columns:          string[];
  rows:             Record<string, unknown>[];
  rowCount:         number;
  executionTimeMs:  number;
  tokensUsed:       number;
  success:          boolean;
  errorMessage:     string | null;
}

export interface QueryHistoryItem {
  id:                    string;
  naturalLanguageQuery:  string;
  generatedSql:          string;
  status:                'Success' | 'Failed' | 'Blocked';
  errorMessage:          string | null;
  rowCount:              number;
  executionTimeMs:       number;
  tokensUsed:            number;
  executedAt:            string;
  connectionName:        string;
}

export interface PaginatedList<T> {
  items:          T[];
  totalCount:     number;
  pageNumber:     number;
  pageSize:       number;
  totalPages:     number;
  hasPreviousPage: boolean;
  hasNextPage:    boolean;
}

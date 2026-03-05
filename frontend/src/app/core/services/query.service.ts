import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Observable }  from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  QueryRequest, QueryResponse, QueryHistoryItem, PaginatedList
} from '../models/query.models';

@Injectable({ providedIn: 'root' })
export class QueryService {
  private readonly url = `${environment.apiUrl}/queries`;

  constructor(private http: HttpClient) {}

  execute(req: QueryRequest): Observable<QueryResponse> {
    return this.http.post<QueryResponse>(`${this.url}/execute`, req);
  }

  getHistory(
    connectionId?: string,
    pageNumber = 1,
    pageSize   = 20
  ): Observable<PaginatedList<QueryHistoryItem>> {
    let params: Record<string, string | number> = { pageNumber, pageSize };
    if (connectionId) params['connectionId'] = connectionId;
    return this.http.get<PaginatedList<QueryHistoryItem>>(
      `${this.url}/history`, { params }
    );
  }
}

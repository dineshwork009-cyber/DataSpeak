import { Injectable }                    from '@angular/core';
import { HttpClient }                    from '@angular/common/http';
import { Observable }                    from 'rxjs';
import { environment }                   from '../../../environments/environment';
import {
  DatabaseConnection, CreateConnectionRequest, TestConnectionResult
} from '../models/connection.models';

@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly url = `${environment.apiUrl}/connections`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<DatabaseConnection[]> {
    return this.http.get<DatabaseConnection[]>(this.url);
  }

  create(req: CreateConnectionRequest): Observable<DatabaseConnection> {
    return this.http.post<DatabaseConnection>(this.url, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  test(id: string): Observable<TestConnectionResult> {
    return this.http.post<TestConnectionResult>(`${this.url}/${id}/test`, {});
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  JoinSessionRequest,
  JoinSessionResponse,
  ParticipantStateDto,
  RenameParticipantRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse
} from '../models/quiz.models';

@Injectable({
  providedIn: 'root'
})
export class ParticipantApiService {
  private baseUrl = `${environment.apiUrl}/participant`;

  constructor(private http: HttpClient) {}

  join(request: JoinSessionRequest): Observable<JoinSessionResponse> {
    return this.http.post<JoinSessionResponse>(`${this.baseUrl}/join`, request);
  }

  getState(sessionCode: string, participantId: string): Observable<ParticipantStateDto> {
    return this.http.get<ParticipantStateDto>(`${this.baseUrl}/session/${sessionCode}/state/${participantId}`);
  }

  rename(request: RenameParticipantRequest): Observable<ParticipantStateDto> {
    return this.http.post<ParticipantStateDto>(`${this.baseUrl}/rename`, request);
  }

  submitAnswer(request: SubmitAnswerRequest): Observable<SubmitAnswerResponse> {
    return this.http.post<SubmitAnswerResponse>(`${this.baseUrl}/answer`, request);
  }
}

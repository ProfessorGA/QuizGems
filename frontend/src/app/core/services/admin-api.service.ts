import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminLoginRequest,
  AdminLoginResponse,
  CreateSessionRequest,
  SessionDetailDto,
  SessionListItemDto,
  ParticipantHubDto,
  VotingStartedHubDto,
  VotingEndedHubDto,
  QuestionResultHubDto,
  ScoreboardEntryDto,
  FinalScoreboardDto
} from '../models/quiz.models';

@Injectable({
  providedIn: 'root'
})
export class AdminApiService {
  private baseUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  login(credentials: AdminLoginRequest): Observable<AdminLoginResponse> {
    return this.http.post<AdminLoginResponse>(`${this.baseUrl}/auth/login`, credentials);
  }

  getCurrentUser(): Observable<{ username: string; role: string; authenticated: boolean }> {
    return this.http.get<{ username: string; role: string; authenticated: boolean }>(`${this.baseUrl}/auth/me`);
  }

  getSessions(): Observable<SessionListItemDto[]> {
    return this.http.get<SessionListItemDto[]>(`${this.baseUrl}/sessions`);
  }

  getSessionById(id: string): Observable<SessionDetailDto> {
    return this.http.get<SessionDetailDto>(`${this.baseUrl}/sessions/${id}`);
  }

  createSession(request: CreateSessionRequest): Observable<SessionDetailDto> {
    return this.http.post<SessionDetailDto>(`${this.baseUrl}/sessions`, request);
  }

  startSession(id: string): Observable<SessionDetailDto> {
    return this.http.post<SessionDetailDto>(`${this.baseUrl}/sessions/${id}/start`, {});
  }

  getParticipants(id: string): Observable<ParticipantHubDto[]> {
    return this.http.get<ParticipantHubDto[]>(`${this.baseUrl}/sessions/${id}/participants`);
  }

  startVoting(id: string): Observable<VotingStartedHubDto> {
    return this.http.post<VotingStartedHubDto>(`${this.baseUrl}/sessions/${id}/voting/start`, {});
  }

  endVoting(id: string): Observable<VotingEndedHubDto> {
    return this.http.post<VotingEndedHubDto>(`${this.baseUrl}/sessions/${id}/voting/end`, {});
  }

  setCorrectAnswer(id: string, correctOption: number): Observable<QuestionResultHubDto> {
    return this.http.post<QuestionResultHubDto>(`${this.baseUrl}/sessions/${id}/correct-answer`, { correctOption });
  }

  nextQuestion(id: string): Observable<{ completed: boolean; nextQuestion?: { questionNumber: number; totalQuestions: number }; finalScoreboard?: FinalScoreboardDto }> {
    return this.http.post<{ completed: boolean; nextQuestion?: { questionNumber: number; totalQuestions: number }; finalScoreboard?: FinalScoreboardDto }>(
      `${this.baseUrl}/sessions/${id}/next-question`,
      {}
    );
  }

  completeQuiz(id: string): Observable<FinalScoreboardDto> {
    return this.http.post<FinalScoreboardDto>(`${this.baseUrl}/sessions/${id}/complete`, {});
  }

  getScoreboard(id: string): Observable<ScoreboardEntryDto[]> {
    return this.http.get<ScoreboardEntryDto[]>(`${this.baseUrl}/sessions/${id}/scoreboard`);
  }

  getResults(id: string): Observable<FinalScoreboardDto> {
    return this.http.get<FinalScoreboardDto>(`${this.baseUrl}/sessions/${id}/results`);
  }

  exportResults(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/sessions/${id}/export`, { responseType: 'blob' });
  }

  deleteSession(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/sessions/${id}`);
  }
}

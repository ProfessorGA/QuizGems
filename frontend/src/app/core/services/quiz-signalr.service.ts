import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ParticipantHubDto,
  SessionStateHubDto,
  VotingStartedHubDto,
  VotingEndedHubDto,
  AnswerSubmittedHubDto,
  AnswerRevealedHubDto,
  QuestionResultHubDto,
  ScoreboardEntryDto,
  NextQuestionHubDto,
  FinalScoreboardDto,
  SubmitAnswerResponse,
  ParticipantStateDto
} from '../models/quiz.models';

export type ConnectionStatus = 'Connected' | 'Reconnecting' | 'Disconnected';

@Injectable({
  providedIn: 'root'
})
export class QuizSignalRService {
  private hubConnection: signalR.HubConnection | null = null;

  public connectionStatus = signal<ConnectionStatus>('Disconnected');

  // Event Subjects
  public participantJoined$ = new Subject<ParticipantHubDto>();
  public participantDisconnected$ = new Subject<{ participantId: string; fullName: string }>();
  public participantReconnected$ = new Subject<{ participantId: string; fullName: string }>();
  public sessionStarted$ = new Subject<SessionStateHubDto>();
  public votingStarted$ = new Subject<VotingStartedHubDto>();
  public votingEnded$ = new Subject<VotingEndedHubDto>();
  public answerSubmitted$ = new Subject<AnswerSubmittedHubDto>();
  public answerRevealed$ = new Subject<AnswerRevealedHubDto>();
  public questionResult$ = new Subject<QuestionResultHubDto>();
  public scoreboardUpdated$ = new Subject<ScoreboardEntryDto[]>();
  public nextQuestion$ = new Subject<NextQuestionHubDto>();
  public quizCompleted$ = new Subject<FinalScoreboardDto>();
  public sessionDeleted$ = new Subject<string>();

  public async startConnection(sessionCode: string, participantId?: string, isAdmin: boolean = false): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      // Re-register group if already connected
      await this.hubConnection.invoke('JoinSessionGroup', sessionCode, participantId || null, isAdmin);
      return;
    }

    const token = localStorage.getItem('qm_admin_token');
    const hubUrl = environment.hubUrl.startsWith('http') 
      ? environment.hubUrl 
      : `${window.location.origin}${environment.hubUrl}`;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => (isAdmin && token ? token : ''),
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.registerEventHandlers();

    this.hubConnection.onreconnecting(() => {
      this.connectionStatus.set('Reconnecting');
    });

    this.hubConnection.onreconnected(async () => {
      this.connectionStatus.set('Connected');
      if (participantId) {
        await this.hubConnection?.invoke('ReconnectParticipant', sessionCode, participantId);
      } else {
        await this.hubConnection?.invoke('JoinSessionGroup', sessionCode, null, isAdmin);
      }
    });

    this.hubConnection.onclose(() => {
      this.connectionStatus.set('Disconnected');
    });

    try {
      await this.hubConnection.start();
      this.connectionStatus.set('Connected');
      await this.hubConnection.invoke('JoinSessionGroup', sessionCode, participantId || null, isAdmin);
    } catch (err) {
      this.connectionStatus.set('Disconnected');
      console.error('SignalR Connection Error: ', err);
      throw err;
    }
  }

  private registerEventHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('ParticipantJoined', (dto: ParticipantHubDto) => this.participantJoined$.next(dto));
    this.hubConnection.on('ParticipantDisconnected', (participantId: string, fullName: string) => this.participantDisconnected$.next({ participantId, fullName }));
    this.hubConnection.on('ParticipantReconnected', (participantId: string, fullName: string) => this.participantReconnected$.next({ participantId, fullName }));
    this.hubConnection.on('SessionStarted', (dto: SessionStateHubDto) => this.sessionStarted$.next(dto));
    this.hubConnection.on('VotingStarted', (dto: VotingStartedHubDto) => this.votingStarted$.next(dto));
    this.hubConnection.on('VotingEnded', (dto: VotingEndedHubDto) => this.votingEnded$.next(dto));
    this.hubConnection.on('AnswerSubmitted', (dto: AnswerSubmittedHubDto) => this.answerSubmitted$.next(dto));
    this.hubConnection.on('AnswerRevealed', (dto: AnswerRevealedHubDto) => this.answerRevealed$.next(dto));
    this.hubConnection.on('QuestionResult', (dto: QuestionResultHubDto) => this.questionResult$.next(dto));
    this.hubConnection.on('ScoreboardUpdated', (dto: ScoreboardEntryDto[]) => this.scoreboardUpdated$.next(dto));
    this.hubConnection.on('NextQuestion', (dto: NextQuestionHubDto) => this.nextQuestion$.next(dto));
    this.hubConnection.on('QuizCompleted', (dto: FinalScoreboardDto) => this.quizCompleted$.next(dto));
    this.hubConnection.on('SessionDeleted', (sessionCode: string) => this.sessionDeleted$.next(sessionCode));
  }

  public async submitAnswer(sessionCode: string, participantId: string, selectedOption: number): Promise<SubmitAnswerResponse> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Real-time connection not active.');
    }
    return await this.hubConnection.invoke<SubmitAnswerResponse>('SubmitAnswer', sessionCode, participantId, selectedOption);
  }

  public async reconnectParticipant(sessionCode: string, participantId: string): Promise<ParticipantStateDto | null> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      return null;
    }
    return await this.hubConnection.invoke<ParticipantStateDto | null>('ReconnectParticipant', sessionCode, participantId);
  }

  public async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.connectionStatus.set('Disconnected');
    }
  }
}

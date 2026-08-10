# Quiz Master — Real-Time Physical Quiz Competition Platform 🏆

A production-ready, ultra low-latency real-time web application engineered specifically for **live in-person / physical quiz competitions**.

---

## 🌟 How It Works (Physical Room Workflow)

* **Quiz Master**: Physically asks questions and announces 4 options in the room verbally using their voice.
* **Admin**: Operates the web application Command Center (starts questions, monitors participant submissions, triggers answer reveals, views the live scoreboard, exports CSV results, and manages temporary sessions).
* **Participants**: Connect via mobile smartphones (entering room code or scanning QR code).
* **Strict Minimalist Participant UI**: Participants **never** see question text or option text. They only see 4 tactile touch buttons: `OPTION 1`, `OPTION 2`, `OPTION 3`, and `OPTION 4`.
* **Server-Authoritative 15-Second Timer**: Countdown is enforced on the .NET 8 backend with sub-millisecond UTC server timestamping.
* **Scoring Rules**:
  * Correct Answer: `+10 points`
  * Fastest Correct Answer Bonus: `+5 bonus points` (Total `15 points`)
  * Incorrect Answer / Timeout: `0 points`

---

## 🛠️ Technology Stack

* **Frontend**: Angular 18 (Standalone Components, Signals, RxJS, Bootstrap 5 Glassmorphism Theme, `@microsoft/signalr`, Canvas Confetti, Web Audio API sound synthesizers)
* **Backend**: .NET 8 Web API, ASP.NET Core SignalR (WebSockets & Server-Sent Events)
* **Database**: PostgreSQL (Npgsql + EF Core) for Production; Embedded SQLite for Zero-Config Local Development
* **Hosting Targets**:
  * Frontend: **Vercel**
  * Backend API & PostgreSQL: **Render**

---

## 🚀 Local Development

### 1. Start Backend (.NET 8):
```bash
dotnet run --project backend/QuizMaster.Api/QuizMaster.Api.csproj
```
- API will start on `http://localhost:5237`.
- Default Admin Credentials:
  - Username: `admin`
  - Password: `Admin@Quiz2026`

### 2. Run Automated Tests:
```bash
dotnet test backend/QuizMaster.slnx
```

### 3. Start Frontend (Angular 18):
```bash
cd frontend
npm install
npm start
```
- Open `http://localhost:4200` in your browser.

---

## ☁️ Deployment Guide

### A. Deploy Backend & PostgreSQL on Render (1-Click Blueprint)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect repository `https://github.com/ProfessorGA/QuizGems.git`.
4. Render will automatically read `render.yaml` and provision:
   - Managed **PostgreSQL Database** (`quizmaster-postgres`).
   - Web Service **.NET 8 API** (`quizmaster-api`).
5. Copy your deployed Backend URL (e.g. `https://quizmaster-api.onrender.com`).

### B. Deploy Frontend on Vercel
1. Go to [Vercel Dashboard](https://vercel.com).
2. Click **Add New Project** and import `https://github.com/ProfessorGA/QuizGems.git`.
3. Configure project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Angular`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/frontend`
4. Set Environment Variable in Vercel:
   - `API_BASE_URL`: `https://your-api-name.onrender.com`
5. Click **Deploy**.

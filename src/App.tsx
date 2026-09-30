import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { CourtMonitorPage } from './pages/CourtMonitorPage';
import { HomePage } from './pages/HomePage';
import { PublicPage } from './pages/PublicPage';
import { RefereeScoreboardPage } from './pages/RefereeScoreboardPage';
import { ViewerPage } from './pages/ViewerPage';
import { ThemeProvider } from './state/ThemeContext';
import { TournamentProvider } from './state/TournamentContext';

export default function App() {
  return (
    <TournamentProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/public" element={<Navigate to="/viewer" replace />} />
            <Route path="/monitor" element={<CourtMonitorPage />} />
            <Route path="/referee" element={<RefereeScoreboardPage />} />
            <Route path="/viewer" element={<ViewerPage />} />
            <Route path="/guest" element={<Navigate to="/viewer" replace />} />
            <Route path="/shared" element={<Navigate to="/viewer" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </TournamentProvider>
  );
}



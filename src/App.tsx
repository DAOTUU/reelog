import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CreditsPage from './pages/CreditsPage'
import DiaryPage from './pages/DiaryPage'
import RecordDetailPage from './pages/RecordDetailPage'
import RecordFormPage from './pages/RecordFormPage'
import SettingsPage from './pages/SettingsPage'
import WatchlistPage from './pages/WatchlistPage'

export default function App() {
  return (
    <Routes>
      {/* 主界面：带底部 tab */}
      <Route element={<Layout />}>
        <Route index element={<DiaryPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* 全屏页：不带 tab，避免录入时被导航分心 */}
      <Route path="/new" element={<RecordFormPage />} />
      <Route path="/edit/:id" element={<RecordFormPage />} />
      <Route path="/record/:id" element={<RecordDetailPage />} />
      <Route path="/credits" element={<CreditsPage />} />
    </Routes>
  )
}

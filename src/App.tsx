import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import UpdatePrompt from './components/UpdatePrompt'
import CreditsPage from './pages/CreditsPage'
import DiaryPage from './pages/DiaryPage'
import RecordDetailPage from './pages/RecordDetailPage'
import RecordFormPage from './pages/RecordFormPage'
import SettingsPage from './pages/SettingsPage'
import WatchlistPage from './pages/WatchlistPage'

export default function App() {
  return (
    <>
      <Routes>
      {/* 主界面：带底部 tab */}
      <Route element={<Layout />}>
        <Route index element={<DiaryPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* 放在 Layout 内：桌面端从侧边栏进来时，导航不该消失 */}
        <Route path="credits" element={<CreditsPage />} />
      </Route>

      {/* 全屏页：不带 tab，避免录入时被导航分心 */}
      <Route path="/new" element={<RecordFormPage />} />
      <Route path="/edit/:id" element={<RecordFormPage />} />
        <Route path="/record/:id" element={<RecordDetailPage />} />
      </Routes>

      {/* 全局：新版本可用时弹提示。见组件内的说明——这东西在 iOS 上不能省。 */}
      <UpdatePrompt />
    </>
  )
}

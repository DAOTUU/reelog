import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// 用 HashRouter 而非 BrowserRouter：部署到 GitHub Pages 这类静态托管时
// 没有服务端 rewrite，BrowserRouter 的深链接会 404，hash 天然免掉这个问题。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

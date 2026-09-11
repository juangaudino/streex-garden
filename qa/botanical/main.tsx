import { createRoot } from 'react-dom/client'
import { App, Studio } from './App'

createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('standalone') ? <App /> : <Studio />)

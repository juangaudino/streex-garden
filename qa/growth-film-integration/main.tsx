import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { GrowthFilmStudio } from '../../src/features/cycles/GrowthFilmStudio'
import { catalogue } from './fixtures'
import '../../src/styles.css'

// Local-only visual validation. Its media and provenance are synthetic; it never calls Garden services.
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/cycle/qa-cycle/film']}>
    <GrowthFilmStudio catalogue={catalogue} backTo="/cycle/qa-cycle" />
  </MemoryRouter>,
)

import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { t } from './i18n';

const LessonPage = lazy(() => import('./lesson/LessonPage'));

function Loading() {
  return (
    <p role="status" style={{ padding: 24 }}>
      {t('app.loading')}
    </p>
  );
}

function TownPlaceholder() {
  return (
    <main style={{ padding: 24, display: 'grid', gap: 12 }}>
      <h1>{t('app.name')}</h1>
      <p>{t('town.placeholder')}</p>
      <Link to="/lesson/chem.ice-floats">{t('town.startIce')}</Link>
    </main>
  );
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Navigate to="/town" replace />} />
        <Route path="/town" element={<TownPlaceholder />} />
        <Route path="/lesson/:id" element={<LessonPage />} />
        <Route path="*" element={<Navigate to="/town" replace />} />
      </Routes>
    </Suspense>
  );
}

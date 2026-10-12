import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { t } from './i18n';

const LessonPage = lazy(() => import('./lesson/LessonPage'));
const TownPage = lazy(() => import('./town/TownPage'));

function Loading() {
  return (
    <p role="status" style={{ padding: 24 }}>
      {t('app.loading')}
    </p>
  );
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Navigate to="/town" replace />} />
        <Route path="/town" element={<TownPage />} />
        <Route path="/lesson/:id" element={<LessonPage />} />
        <Route path="*" element={<Navigate to="/town" replace />} />
      </Routes>
    </Suspense>
  );
}

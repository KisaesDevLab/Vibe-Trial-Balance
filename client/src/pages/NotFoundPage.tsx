// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Link, useLocation } from 'react-router-dom';

export function NotFoundPage() {
  const location = useLocation();
  return (
    <div className="p-12 text-center">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        No route matches <code className="font-mono">{location.pathname}</code>.
      </p>
      <Link to="/dashboard" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        Return to Dashboard
      </Link>
    </div>
  );
}

// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const classes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={`${classes[size]} border-2 border-gray-300 dark:border-gray-600 border-t-gray-700 dark:border-t-gray-300 rounded-full animate-spin`} />
  );
}

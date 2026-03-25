export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const classes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={`${classes[size]} border-2 border-gray-300 dark:border-gray-600 border-t-gray-700 dark:border-t-gray-300 rounded-full animate-spin`} />
  );
}

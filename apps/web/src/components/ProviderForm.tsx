// Single responsibility: Form component for creating and editing AI provider configurations.

import type { ProviderPublic, ProviderCreateInput } from '../types/providers';

export interface ProviderFormProps {
  mode: 'create' | 'edit';
  initial?: ProviderPublic;
  onSave: (input: ProviderCreateInput & { enabled?: boolean }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

export function ProviderForm({ onCancel }: ProviderFormProps) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Provider configuration form
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Back to list
      </button>
    </div>
  );
}

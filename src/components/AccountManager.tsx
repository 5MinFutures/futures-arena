import { useState } from 'react';
import { supabase } from '../supabaseClient';

interface AccountManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  accountIds: string[];
  onAccountsChange: (ids: string[]) => void;
}

const MAX_ACCOUNTS = 10;

const AccountManager = ({ isOpen, onClose, userId, accountIds, onAccountsChange }: AccountManagerProps) => {
  const [newId, setNewId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = async () => {
    const trimmed = newId.trim().toUpperCase();
    if (!trimmed) return;
    if (accountIds.includes(trimmed)) {
      setError('That account ID is already linked.');
      return;
    }
    if (accountIds.length >= MAX_ACCOUNTS) {
      setError(`You can only link up to ${MAX_ACCOUNTS} account IDs.`);
      return;
    }
    setLoading(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('account_mappings')
      .insert({ user_id: userId, account_id: trimmed });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      onAccountsChange([...accountIds, trimmed]);
      setNewId('');
    }
  };

  const handleDelete = async (accountId: string) => {
    setLoading(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from('account_mappings')
      .delete()
      .match({ user_id: userId, account_id: accountId });
    setLoading(false);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      onAccountsChange(accountIds.filter(id => id !== accountId));
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold">Manage Account IDs</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {accountIds.length} / {MAX_ACCOUNTS} accounts linked
        </p>

        {accountIds.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4 italic">
            No accounts linked yet. Add your first account ID below.
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {accountIds.map(id => (
              <li key={id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                <span className="font-mono text-sm font-medium">{id}</span>
                <button
                  onClick={() => handleDelete(id)}
                  disabled={loading}
                  className="text-red-500 hover:text-red-700 text-sm font-semibold disabled:opacity-50"
                  aria-label={`Remove ${id}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {accountIds.length < MAX_ACCOUNTS && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newId}
              onChange={(e) => { setNewId(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. SIM3050499F"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button
              onClick={handleAdd}
              disabled={loading || !newId.trim()}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Add
            </button>
          </div>
        )}

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
};

export default AccountManager;

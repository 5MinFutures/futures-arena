import { useState, useEffect, useRef } from 'react';

interface AccountDropdownProps {
  accountIds: string[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  onManageClick: () => void;
  onDeleteAccount: (id: string) => void;
}

const AccountDropdown = ({ accountIds, selectedIds, onChange, onManageClick, onDeleteAccount }: AccountDropdownProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const allCheckboxRef = useRef<HTMLInputElement>(null);

  const allSelected = accountIds.length > 0 && selectedIds.size === accountIds.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // Button label
  const label = accountIds.length === 0
    ? 'No accounts'
    : allSelected
      ? 'All Accounts'
      : `${selectedIds.size} of ${accountIds.length} accounts`;

  // Sync indeterminate state on "All" checkbox (can't be done via JSX prop)
  useEffect(() => {
    if (allCheckboxRef.current) {
      allCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAllToggle = () => {
    // If all selected → deselect all; otherwise → select all
    onChange(allSelected ? new Set<string>() : new Set(accountIds));
  };

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds); // always a new Set instance
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium mr-0.5">Accounts:</span>
        <span className="font-mono">{label}</span>
        <svg className="w-3.5 h-3.5 text-gray-400 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg min-w-[180px] py-1">
          {/* "All" checkbox */}
          <label className="flex items-center gap-2 px-3 py-1.5 font-semibold text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
            <input
              ref={allCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={handleAllToggle}
              className="rounded border-gray-300"
            />
            All
          </label>

          {accountIds.length > 0 && <hr className="my-1 border-gray-100 dark:border-slate-700" />}

          {/* Per-account rows */}
          {accountIds.map(id => (
            <div key={id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700">
              <label className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(id)}
                  onChange={() => handleToggle(id)}
                  className="rounded border-gray-300 shrink-0"
                />
                <span className="font-mono truncate">{id}</span>
              </label>
              <button
                onClick={() => onDeleteAccount(id)}
                className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                aria-label={`Remove ${id}`}
                title="Remove account"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          <hr className="my-1 border-gray-100" />

          <button
            onClick={() => { onManageClick(); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Manage Accounts
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountDropdown;

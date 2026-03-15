import { useState, useEffect, useRef } from 'react';

interface PortfolioDropdownProps {
  portfolioNames: string[];
  selectedNames: Set<string>;
  onChange: (next: Set<string>) => void;
}

const PortfolioDropdown = ({ portfolioNames, selectedNames, onChange }: PortfolioDropdownProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const allCheckboxRef = useRef<HTMLInputElement>(null);

  const total = portfolioNames.length;
  const selectedCount = selectedNames.size;
  const allSelected = total > 0 && selectedCount === total;
  const someSelected = selectedCount > 0 && !allSelected;

  const label =
    total === 0
      ? 'No portfolios'
      : selectedCount === total
        ? 'All Portfolios'
        : `${selectedCount} of ${total} portfolios`;

  useEffect(() => {
    if (allCheckboxRef.current) {
      allCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

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
    onChange(allSelected ? new Set<string>() : new Set(portfolioNames));
  };

  const handleToggle = (name: string) => {
    const next = new Set(selectedNames);
    next.has(name) ? next.delete(name) : next.add(name);
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
        <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium mr-0.5">Portfolios:</span>
        <span className="font-mono">{label}</span>
        <svg className="w-3.5 h-3.5 text-gray-400 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg min-w-[180px] py-1">
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

          {portfolioNames.length > 0 && <hr className="my-1 border-gray-100 dark:border-slate-700" />}

          {portfolioNames.map(name => (
            <label key={name} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
              <input
                type="checkbox"
                checked={selectedNames.has(name)}
                onChange={() => handleToggle(name)}
                className="rounded border-gray-300"
              />
              <span className="font-mono">{name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortfolioDropdown;

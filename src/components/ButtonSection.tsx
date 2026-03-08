import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import skoolLogo from '../assets/skool-logo.png';
import { supabase } from '../supabaseClient';
import LoginModal from './LoginModal';
import AccountManager from './AccountManager';
import AccountSelector from './AccountSelector';

interface ButtonSectionProps {
  onFetchSupabase: (accountIds: string[]) => void;
  processing: boolean;
}

const ButtonSection = ({ onFetchSupabase, processing }: ButtonSectionProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [checkedAccountIds, setCheckedAccountIds] = useState<Set<string>>(new Set());
  const [showAccountManager, setShowAccountManager] = useState(false);

  const fetchAccountIds = async (userId: string) => {
    const { data, error } = await supabase
      .from('account_mappings')
      .select('account_id')
      .eq('user_id', userId);

    if (error || !data) return;

    const ids = data.map((row: { account_id: string }) => row.account_id);
    setAccountIds(ids);
    setCheckedAccountIds(new Set(ids));

    if (ids.length === 0) {
      setShowAccountManager(true);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAccountIds(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setShowModal(false);
        fetchAccountIds(session.user.id);
      } else {
        setAccountIds([]);
        setCheckedAccountIds(new Set());
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAccountsChange = (newIds: string[]) => {
    setAccountIds(newIds);
    setCheckedAccountIds(prev => {
      const next = new Set(prev);
      newIds.forEach(id => next.add(id));
      Array.from(prev).forEach(id => { if (!newIds.includes(id)) next.delete(id); });
      return next;
    });
  };

  const handleToggle = (id: string) => {
    setCheckedAccountIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleLoadData = () => {
    const ids = Array.from(checkedAccountIds);
    if (ids.length === 0) {
      alert('Please select at least one account ID to load data.');
      return;
    }
    onFetchSupabase(ids);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-end gap-2 sm:gap-3 mb-2 sm:mb-3">
        {/* Load Data Button */}
        <button
          onClick={handleLoadData}
          disabled={processing}
          className="w-full sm:w-auto px-4 py-2 min-h-[44px] bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Load data from database"
        >
          Load Data
        </button>

        {/* skool.com/futures Button */}
        <a
          href="https://www.skool.com/futures"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-black text-[#84cc16] font-bold rounded-md hover:bg-gray-900 transition-colors"
          aria-label="Join our Skool community"
        >
          <img src={skoolLogo} alt="Skool" className="h-5 w-5" />
          <span>skool.com/futures</span>
        </a>

        {/* Log In / Sign Out Button */}
        {session ? (
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full sm:w-auto px-4 py-2 min-h-[44px] bg-gray-200 text-gray-700 font-bold rounded-md hover:bg-gray-300 transition-colors"
            aria-label="Sign out"
          >
            Sign Out
          </button>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto px-4 py-2 min-h-[44px] bg-gray-200 text-gray-700 font-bold rounded-md hover:bg-gray-300 transition-colors"
            aria-label="Log in"
          >
            Log In
          </button>
        )}
      </div>

      {session && (
        <div className="flex justify-end mb-4 sm:mb-6">
          <AccountSelector
            accountIds={accountIds}
            checkedIds={checkedAccountIds}
            onToggle={handleToggle}
            onManageClick={() => setShowAccountManager(true)}
          />
        </div>
      )}

      <LoginModal isOpen={showModal} onClose={() => setShowModal(false)} />

      {session && (
        <AccountManager
          isOpen={showAccountManager}
          onClose={() => setShowAccountManager(false)}
          userId={session.user.id}
          accountIds={accountIds}
          onAccountsChange={handleAccountsChange}
        />
      )}
    </>
  );
};

export default ButtonSection;

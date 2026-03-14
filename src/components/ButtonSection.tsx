import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import skoolLogo from '../assets/skool-logo.png';
import { supabase } from '../supabaseClient';
import LoginModal from './LoginModal';
import AccountManager from './AccountManager';
import AccountDropdown from './AccountDropdown';

interface ButtonSectionProps {
  onFetchSupabase: () => void;
  processing: boolean;
  /** Called whenever the user's linked account list changes (login, add, remove, logout). App owns linkedAccountIds. */
  onAccountsLoaded: (ids: string[]) => void;
  /** Controlled by App — which accounts are selected for display. */
  selectedAccountIds: Set<string>;
  onSelectedAccountIdsChange: (ids: Set<string>) => void;
}

const ButtonSection = ({
  onFetchSupabase,
  processing,
  onAccountsLoaded,
  selectedAccountIds,
  onSelectedAccountIdsChange,
}: ButtonSectionProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [showAccountManager, setShowAccountManager] = useState(false);

  const fetchAccountIds = async (userId: string) => {
    const { data, error } = await supabase
      .from('account_mappings')
      .select('account_id')
      .eq('user_id', userId);

    if (error || !data) return;

    const ids = data.map((row: { account_id: string }) => row.account_id);
    setAccountIds(ids);
    onAccountsLoaded(ids); // App sets linkedAccountIds + resets selectedAccountIds to all

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
        onAccountsLoaded([]); // clears linkedAccountIds and selectedAccountIds in App
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Called by AccountManager when user adds or removes an account via the modal.
  // All paths that mutate the account list must flow through here so App stays in sync.
  const handleAccountsChange = (newIds: string[]) => {
    setAccountIds(newIds);
    onAccountsLoaded(newIds); // App resets selectedAccountIds to include new/remove old accounts
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-end gap-2 sm:gap-3 mb-2 sm:mb-3">
        {/* Load Data — always fetches all linked accounts; does NOT affect selectedAccountIds */}
        <button
          onClick={onFetchSupabase}
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

      {/* Account filter dropdown — display-only, never triggers Supabase */}
      {session && accountIds.length > 0 && (
        <div className="flex justify-end mb-4 sm:mb-6">
          <AccountDropdown
            accountIds={accountIds}
            selectedIds={selectedAccountIds}
            onChange={onSelectedAccountIdsChange}
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

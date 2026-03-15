import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import ButtonSection from './components/ButtonSection.tsx';
import Header from './components/Header.tsx';
import UploadSection from './components/UploadSection.tsx';
import ErrorList from './components/ErrorList.tsx';
import UploadedFilesList from './components/UploadedFilesList.tsx';
import AnalyticsControls from './components/AnalyticsControls.tsx';
import PortfolioDropdown from './components/PortfolioDropdown.tsx';
import PortfolioSection from './components/PortfolioSection.tsx';
import CorrelationSection from './components/CorrelationSection.tsx';
import MetricsTable from './components/MetricsTable.tsx';
import SessionComplete from './components/SessionComplete.tsx';
import useMetrics from './hooks/useMetrics.ts';
import usePortfolio from './hooks/usePortfolio.ts';
import useSorting from './hooks/useSorting.ts';
import useContractMultipliers from './hooks/useContractMultipliers.ts';
import { parseCSV, processCurrencyColumns, buildCorrelationMatrix, calculateMetricsFromDatabase, buildFilenameFromMetadata } from './utils/dataUtils.ts';

interface CleanedData {
  [key: string]: {
    header: string[];
    data: (string | number)[][];
    rowCount: number;
    columnCount: number;
  };
}

interface DatabaseTrade {
  trade_date: string;
  trade_time: string;
  profit: number;
  trade_type?: string | null;
  notes?: string | null;
}

interface StrategyFromDB {
  strategy_id: string;
  account_id?: string | null; // used to build strategyAccountMap for display filtering
  market: string;
  direction: string;
  strategy_name: string;
  display_name?: string;
  portfolio_hint?: string | null;
  is_intraday: boolean;
  contract_multiplier: number;
  margin_required?: number | null;
  is_benchmark: boolean;
  trades?: DatabaseTrade[]; // Added dynamically in fetchFromSupabase
}

const App = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [cleanedData, setCleanedData] = useState<CleanedData>({});
  const [processing, setProcessing] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showMetrics, setShowMetrics] = useState<boolean>(false);
  const [showPortfolio, setShowPortfolio] = useState<boolean>(true);
  const [showCorrelation, setShowCorrelation] = useState<boolean>(true);
  const [selectedTradeLists, setSelectedTradeLists] = useState<Set<string>>(new Set<string>());
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [chartType, setChartType] = useState<string>('equity');
  const [normalizeEquity, setNormalizeEquity] = useState<boolean>(false);
  const [startingCapital, setStartingCapital] = useState<number>(1000000);
  const [showUploadedFiles, setShowUploadedFiles] = useState<boolean>(false);
  const [correlationThreshold, setCorrelationThreshold] = useState<number>(0.5);
  const [correlationMatrix, setCorrelationMatrix] = useState<{ matrix: number[][]; strategies: string[]; size: number } | null>(null);
  const [correlationCalculating, setCorrelationCalculating] = useState<boolean>(false);
  const [strategyIdMap, setStrategyIdMap] = useState<Record<string, string>>({});
  // Maps filename → account_id; used to derive displayCleanedData without touching Supabase
  const [strategyAccountMap, setStrategyAccountMap] = useState<Record<string, string>>({});
  // Full list of accounts linked to the logged-in user (source of truth for fetching)
  const [linkedAccountIds, setLinkedAccountIds] = useState<string[]>([]);
  // Display-only filter: which accounts' strategies to show (never drives Supabase queries)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  // Display-only portfolio filter: which portfolios to show (client-side, no Supabase calls)
  const [selectedPortfolioNames, setSelectedPortfolioNames] = useState<Set<string>>(new Set());
  // Per-user display name overrides for DB-backed strategies (keyed by `${account_id}::${strategy_id}`)
  type AliasMap = Record<string, { displayName: string | null; portfolioDisplayName: string | null }>;
  const [aliasMap, setAliasMap] = useState<AliasMap>({});
  const [savedViews, setSavedViews] = useState<Array<{ id: string; name: string; created_at: string }>>([]);

  const refreshSavedViews = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('portfolio_views')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) console.error('[refreshSavedViews] error', error);
    if (data) setSavedViews(data);
  };

  useEffect(() => {
    refreshSavedViews();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const savePortfolioView = async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const strategyIds = Array.from(selectedTradeLists)
      .map(filename => strategyIdMap[filename])
      .filter((id): id is string => !!id);

    const { error } = await supabase.from('portfolio_views').insert({
      user_id: user.id,
      name,
      strategy_ids: strategyIds,
      date_start: dateRange.start ?? null,
      date_end: dateRange.end ?? null,
    });

    if (!error) {
      await refreshSavedViews();
    } else {
      console.error('[savePortfolioView] error', error);
    }
  };

  const loadPortfolioView = async (viewId: string) => {
    const { data, error } = await supabase
      .from('portfolio_views')
      .select('*')
      .eq('id', viewId)
      .single();

    if (error || !data) {
      console.error('[loadPortfolioView] error', error);
      return;
    }

    const idToFilename = Object.fromEntries(
      Object.entries(strategyIdMap).map(([filename, id]) => [id, filename])
    );

    const filenames = (data.strategy_ids || [])
      .map((id: string) => idToFilename[id])
      .filter((f: string | undefined): f is string => !!f);

    setSelectedTradeLists(new Set(filenames));
    setDateRange({
      start: data.date_start ? String(data.date_start) : null,
      end: data.date_end ? String(data.date_end) : null,
    });
  };

  // Derived view of cleanedData filtered by selectedAccountIds.
  // CSV uploads (no entry in strategyAccountMap) always pass through.
  // Guards that check "do we have any data?" still use cleanedData directly.
  const displayCleanedData = useMemo(() => {
    const result: CleanedData = {};
    Object.keys(cleanedData).forEach(filename => {
      const acctId = strategyAccountMap[filename];
      if (!acctId || selectedAccountIds.has(acctId)) {
        result[filename] = cleanedData[filename];
      }
    });
    return result;
  }, [cleanedData, strategyAccountMap, selectedAccountIds]);

  const { contractMultipliers, masterContractValue, setMasterContractValue, handleContractChange, applyMasterToAll } = useContractMultipliers();
  const { sortConfig, sortPriorities, showAdvancedSort, setShowAdvancedSort, handleSort, addSortPriority, removeSortPriority, updateSortPriority, clearSorting, applyAdvancedSort } = useSorting();
  const { allMetrics, sortedAndFilteredMetrics } = useMetrics(displayCleanedData, contractMultipliers, sortConfig, sortPriorities);

  // Apply per-user display name aliases on top of computed metrics (DB strategies only)
  const aliasedAllMetrics = useMemo(() => {
    if (!allMetrics || Object.keys(aliasMap).length === 0) return allMetrics;
    const result = { ...allMetrics };
    for (const [filename, metrics] of Object.entries(result)) {
      const accountId = strategyAccountMap[filename];
      const strategyId = strategyIdMap[filename];
      if (accountId && strategyId) {
        const alias = aliasMap[`${accountId}::${strategyId}`];
        if (alias) {
          result[filename] = {
            ...(metrics as any),
            strategyName: alias.displayName || (metrics as any).strategyName,
            portfolioHint: alias.portfolioDisplayName || (metrics as any).portfolioHint,
          };
        }
      }
    }
    return result;
  }, [allMetrics, aliasMap, strategyAccountMap, strategyIdMap]);

  // Distinct sorted portfolio names from loaded metrics
  const allPortfolioNames = useMemo(() =>
    [...new Set(
      Object.values(aliasedAllMetrics || {})
        .map((m: any) => m.portfolioHint || '--')
        .filter(Boolean)
    )].sort(),
    [aliasedAllMetrics]
  );

  // Auto-select all portfolios on first load only. Ref sentinel ensures this runs once
  // per data-load, not on every checkbox toggle (avoids firing when selectedPortfolioNames.size changes).
  const portfolioInitialized = useRef(false);
  useEffect(() => {
    if (!portfolioInitialized.current && allPortfolioNames.length > 0) {
      portfolioInitialized.current = true;
      setSelectedPortfolioNames(new Set(allPortfolioNames));
    }
  }, [allPortfolioNames.join(',')]);

  // Alias overlay for the sorted array (feeds MetricsTable display)
  const aliasedSortedMetrics = useMemo(() => {
    if (Object.keys(aliasMap).length === 0) return sortedAndFilteredMetrics;
    return sortedAndFilteredMetrics.map((metrics: any) => {
      const accountId = strategyAccountMap[metrics.originalFilename];
      const strategyId = strategyIdMap[metrics.originalFilename];
      if (!accountId || !strategyId) return metrics;
      const alias = aliasMap[`${accountId}::${strategyId}`];
      if (!alias) return metrics;
      return {
        ...metrics,
        strategyName: alias.displayName || metrics.strategyName,
        portfolioHint: alias.portfolioDisplayName || metrics.portfolioHint,
      };
    });
  }, [sortedAndFilteredMetrics, aliasMap, strategyAccountMap, strategyIdMap]);

  const portfolioFilteredMetrics = useMemo(() => {
    if (allPortfolioNames.length === 0) return aliasedSortedMetrics;
    if (selectedPortfolioNames.size === 0) return [];
    if (selectedPortfolioNames.size === allPortfolioNames.length) return aliasedSortedMetrics;
    return aliasedSortedMetrics.filter((m: any) =>
      selectedPortfolioNames.has(m.portfolioHint || '--')
    );
  }, [aliasedSortedMetrics, selectedPortfolioNames, allPortfolioNames.length]);

  const portfolioFilteredAllMetrics = useMemo(() => {
    if (allPortfolioNames.length === 0) return aliasedAllMetrics;
    if (selectedPortfolioNames.size === 0) return {};
    if (selectedPortfolioNames.size === allPortfolioNames.length) return aliasedAllMetrics;
    return Object.fromEntries(
      Object.entries(aliasedAllMetrics || {}).filter(([, m]: [string, any]) =>
        selectedPortfolioNames.has((m as any).portfolioHint || '--')
      )
    );
  }, [aliasedAllMetrics, selectedPortfolioNames, allPortfolioNames.length]);

  // Wrapper function to apply master contract value to only visible (filtered) rows
  const applyMasterToFiltered = useCallback((value: number) => {
    const visibleKeys = portfolioFilteredMetrics.map((m: any) => m.originalFilename);
    applyMasterToAll(value, visibleKeys);
  }, [portfolioFilteredMetrics, applyMasterToAll]);
  const { portfolioData, individualChartsData, dailyReturnsMap } = usePortfolio(portfolioFilteredAllMetrics || {}, selectedTradeLists, dateRange, normalizeEquity, startingCapital, contractMultipliers);

  // Auto-enable "Show Metrics" when files are added
  useEffect(() => {
    if (Object.keys(cleanedData).length > 0) {
      setShowMetrics(true);
    }
  }, [cleanedData]);

  // Correlation matrix computation
  useEffect(() => {
    if (showCorrelation && selectedTradeLists.size >= 2) {
      setCorrelationCalculating(true);
      const matrix = buildCorrelationMatrix(dailyReturnsMap, selectedTradeLists);
      setCorrelationMatrix(matrix);
      setCorrelationCalculating(false);
    }
  }, [showCorrelation, selectedTradeLists, dailyReturnsMap]);


  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === 'string') {
          resolve(e.target.result);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleFileUpload = useCallback(async (selectedFiles: File[]) => {
    setProcessing(true);
    setErrors([]);
    const newCleanedData: CleanedData = { ...cleanedData };
    const newFilenames: string[] = [];
    for (const file of selectedFiles) {
      try {
        const content = await readFileContent(file);
        const parsed = parseCSV(content);
        const processed = processCurrencyColumns(parsed.data, parsed.header);
        newCleanedData[file.name] = {
          header: parsed.header,
          data: processed,
          rowCount: processed.length,
          columnCount: parsed.header.length
        };
        newFilenames.push(file.name);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setErrors(prev => [...prev, `Error processing ${file.name}: ${errorMessage}`]);
      }
    }
    setCleanedData(newCleanedData);
    // Auto-select newly uploaded files
    setSelectedTradeLists(prev => {
      const newSet = new Set(prev);
      newFilenames.forEach(filename => newSet.add(filename));
      return newSet;
    });
    setProcessing(false);
  }, [cleanedData]);

  const removeFile = (filename: string) => {
    setFiles(prev => prev.filter(f => f.name !== filename));
    setCleanedData(prev => {
      const updated = { ...prev };
      delete updated[filename];
      return updated;
    });
    setSelectedTradeLists(prev => {
      const newSet = new Set(prev);
      newSet.delete(filename);
      return newSet;
    });
    setStrategyAccountMap(prev => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
  };

  const exportCleanedData = (filename: string) => {
    const data = cleanedData[filename];
    if (!data) return;
    try {
      const csvContent = [
        data.header.join(','),
        ...data.data.map(row => row.map(cell => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(','))
      ].join('\n');
      const element = document.createElement('a');
      const fileBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      element.href = URL.createObjectURL(fileBlob);
      element.download = `cleaned_${filename}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setTimeout(() => URL.revokeObjectURL(element.href), 1000);
    } catch (error) {
      console.error('Download failed:', error);
      const csvContent = [
        data.header.join(','),
        ...data.data.map(row => row.join(','))
      ].join('\n');
      navigator.clipboard.writeText(csvContent).then(() => {
        alert('Download failed, but data has been copied to clipboard. Paste it into a text file and save as .csv');
      }).catch(() => {
        alert('Download failed. Please check browser settings or try a different browser.');
      });
    }
  };

  const toggleTradeListSelection = (filename: string) => {
    setSelectedTradeLists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return newSet;
    });
  };

  // Fetches ALL strategies for all linked accounts — never filtered by selectedAccountIds.
  // Display filtering is handled by the displayCleanedData memo.
  const fetchFromSupabase = async () => {
    setProcessing(true);
    setErrors([]);

    try {
      // Fetch strategies (without embedded trades to avoid nested query limits)
      let query = supabase
        .from('strategies')
        .select(`
          strategy_id,
          account_id,
          market,
          direction,
          strategy_name,
          display_name,
          portfolio_hint,
          is_intraday,
          contract_multiplier,
          margin_required,
          is_benchmark
        `);

      if (linkedAccountIds.length > 0) {
        query = query.in('account_id', linkedAccountIds);
      }

      const { data: strategies, error: strategiesError } = await query;

      if (strategiesError) {
        const errorDetails = [
          strategiesError.message,
          strategiesError.details ? `Details: ${strategiesError.details}` : null,
          strategiesError.hint ? `Hint: ${strategiesError.hint}` : null
        ].filter(Boolean).join('. ');
        throw new Error(errorDetails || 'Supabase query failed');
      }

      if (!strategies || !Array.isArray(strategies) || strategies.length === 0) {
        throw new Error('No strategies found in database');
      }

      // Type assertion for strategies with trades property
      const typedStrategies = strategies as StrategyFromDB[];

      // Fetch display name aliases for the current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const newAliasMap: AliasMap = {};
      if (currentUser && linkedAccountIds.length > 0) {
        const { data: aliases } = await supabase
          .from('strategy_aliases')
          .select('account_id, strategy_id, display_name, portfolio_display_name')
          .eq('user_id', currentUser.id)
          .in('account_id', linkedAccountIds);
        if (aliases) {
          for (const a of aliases) {
            newAliasMap[`${a.account_id}::${a.strategy_id}`] = {
              displayName: a.display_name,
              portfolioDisplayName: a.portfolio_display_name,
            };
          }
        }
      }

      // Fetch trades for each strategy separately to avoid embedded resource limits
      for (const strategy of typedStrategies) {
        const { data: trades, error: tradesError } = await supabase
          .from('trades')
          .select('trade_date, trade_time, profit, trade_type, notes')
          .eq('strategy_id', strategy.strategy_id)
          .order('trade_date', { ascending: true })
          .order('trade_time', { ascending: true })
          .limit(10000); // Explicit high limit to get all trades

        if (tradesError) {
          throw new Error(`Failed to fetch trades for ${strategy.strategy_id}: ${tradesError.message}`);
        }

        // Attach trades to strategy object
        strategy.trades = (trades as DatabaseTrade[]) || [];
      }

      // Transform database data to cleanedData format
      const newCleanedData: CleanedData = { ...cleanedData };
      const newFilenames: string[] = [];
      const fileErrors: string[] = [];
      const newStrategyIdMap: Record<string, string> = { ...strategyIdMap };
      const newStrategyAccountMap: Record<string, string> = { ...strategyAccountMap };

      for (const strategy of typedStrategies) {
        try {
          if (!strategy.trades || strategy.trades.length === 0) {
            fileErrors.push(`No trades found for strategy: ${strategy.strategy_id}`);
            continue;
          }

          // Build filename from metadata
          const filename = buildFilenameFromMetadata(strategy) + '.csv';
          
          // Store mapping for deletion
          newStrategyIdMap[filename] = strategy.strategy_id;
          // Store account mapping for display filtering
          if (strategy.account_id) newStrategyAccountMap[filename] = strategy.account_id;

          // Calculate metrics from database trades
          const metrics = calculateMetricsFromDatabase(strategy.trades, strategy);

          if (!metrics) {
            fileErrors.push(`Failed to calculate metrics for: ${strategy.strategy_id}`);
            continue;
          }

          // Build cleanedData structure matching CSV format
          const dataRows: (string | number)[][] = [];
          let cumEquity = 0;

          strategy.trades.forEach((trade: any) => {
            const profit = typeof trade.profit === 'number' ? trade.profit : parseFloat(trade.profit) || 0;
            cumEquity += profit;
            const datetime = `${trade.trade_date} ${trade.trade_time}`;

            dataRows.push([
              datetime,
              profit.toString(),
              cumEquity.toString()
            ]);
          });

          newCleanedData[filename] = {
            header: ["Date/Time", "Profit/Loss", "Cum Net Profit"],
            data: dataRows,
            rowCount: strategy.trades.length,
            columnCount: 3
          };

          newFilenames.push(filename);

          // Pre-populate contract multiplier from database
          handleContractChange(filename, strategy.contract_multiplier || 1.0);

        } catch (strategyError: unknown) {
          const errorMsg = strategyError instanceof Error ? strategyError.message : 'Unknown error';
          fileErrors.push(`Error processing ${strategy.strategy_id}: ${errorMsg}`);
        }
      }

      // Report errors if any
      if (fileErrors.length > 0) {
        setErrors(prev => [...prev, ...fileErrors]);
      }

      if (newFilenames.length === 0) {
        throw new Error('No valid strategies could be loaded from database');
      }

      // Update cleanedData state
      console.log('[maps] strategyIdMap keys', Object.keys(newStrategyIdMap));
      console.log('[maps] strategyAccountMap keys', Object.keys(newStrategyAccountMap));
      setAliasMap(newAliasMap);
      setCleanedData(newCleanedData);
      setStrategyIdMap(newStrategyIdMap);
      setStrategyAccountMap(newStrategyAccountMap);

      // Auto-select newly loaded strategies
      setSelectedTradeLists(prev => {
        const newSet = new Set(prev);
        newFilenames.forEach(filename => newSet.add(filename));
        return newSet;
      });

    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const supabaseError = error as any;
        errorMessage = supabaseError.message || supabaseError.error_description || JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      setErrors(prev => [...prev, `Database fetch error: ${errorMessage}`]);
    } finally {
      setProcessing(false);
    }
  };

  const exportCorrelationData = () => {
    if (!correlationMatrix) return;
    const { matrix, strategies } = correlationMatrix;
    const headers = ['Strategy 1', 'Strategy 2', 'Correlation', 'Sample Size', 'Period'];
    const rows: (string | number)[][] = [];
    for (let i = 0; i < strategies.length; i++) {
      for (let j = i + 1; j < strategies.length; j++) {
        const strategy1 = strategies[i].replace('.csv', '');
        const strategy2 = strategies[j].replace('.csv', '');
        const correlation = matrix[i][j];
        rows.push([
          strategy1,
          strategy2,
          correlation.toFixed(4),
          dailyReturnsMap.get(strategies[i])?.length || 0,
          `${dateRange.start || 'All'} to ${dateRange.end || 'All'}`
        ]);
      }
    }
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    const element = document.createElement('a');
    const fileBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    element.href = URL.createObjectURL(fileBlob);
    element.download = 'correlation_data.csv';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDeleteStrategy = async (filename: string) => {
    const strategyId = strategyIdMap[filename];
    
    if (strategyId) {
      // It's a database strategy
      if (window.confirm(`Are you sure you want to PERMANENTLY delete strategy "${filename}" from the database? This cannot be undone.`)) {
        try {
          setProcessing(true);
          const { error } = await supabase.from('strategies').delete().eq('strategy_id', strategyId);
          
          if (error) {
            throw error;
          }
          
          // If successful, remove from local state
          removeFile(filename);
          
          // Also remove from strategyIdMap and strategyAccountMap
          setStrategyIdMap(prev => {
            const next = { ...prev };
            delete next[filename];
            return next;
          });
          setStrategyAccountMap(prev => {
            const next = { ...prev };
            delete next[filename];
            return next;
          });
          
          alert('Strategy deleted successfully from database.');
        } catch (error: any) {
          alert(`Error deleting strategy: ${error.message || error}`);
        } finally {
          setProcessing(false);
        }
      }
    } else {
      // It's a local CSV file, just remove from view
      removeFile(filename);
    }
  };

  const onUpdateAlias = async (
    accountId: string,
    strategyId: string,
    names: { displayName?: string; portfolioDisplayName?: string }
  ) => {
    console.log('[onUpdateAlias] called', { accountId, strategyId, names });
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { console.warn('[onUpdateAlias] no authenticated user'); return; }

    const key = `${accountId}::${strategyId}`;
    const existing = aliasMap[key];

    // undefined = "don't change field"; empty string = "clear override"
    const newDisplayName = names.displayName !== undefined
      ? (names.displayName || null)
      : (existing?.displayName ?? null);
    const newPortfolioDisplayName = names.portfolioDisplayName !== undefined
      ? (names.portfolioDisplayName || null)
      : (existing?.portfolioDisplayName ?? null);

    if (!newDisplayName && !newPortfolioDisplayName) {
      // Both empty — delete the alias row
      const { error: delError } = await supabase.from('strategy_aliases').delete()
        .eq('user_id', currentUser.id)
        .eq('account_id', accountId)
        .eq('strategy_id', strategyId);
      if (delError) console.error('[onUpdateAlias] delete error', delError);
      setAliasMap(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      const { error: upsertError } = await supabase.from('strategy_aliases').upsert(
        {
          user_id: currentUser.id,
          account_id: accountId,
          strategy_id: strategyId,
          display_name: newDisplayName,
          portfolio_display_name: newPortfolioDisplayName,
        },
        { onConflict: 'user_id,account_id,strategy_id' }
      );
      if (upsertError) console.error('[onUpdateAlias] upsert error', upsertError);
      setAliasMap(prev => ({
        ...prev,
        [key]: { displayName: newDisplayName, portfolioDisplayName: newPortfolioDisplayName },
      }));
    }
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-7xl">
      <ButtonSection
        onFetchSupabase={fetchFromSupabase}
        processing={processing}
        onAccountsLoaded={(ids) => {
          setLinkedAccountIds(ids);
          setSelectedAccountIds(new Set(ids)); // default: all accounts selected
        }}
        selectedAccountIds={selectedAccountIds}
        onSelectedAccountIdsChange={setSelectedAccountIds}
      />
      <Header />
      <UploadSection onFileChange={(e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) {
          handleFileUpload(Array.from(target.files));
        }
      }} processing={processing} />
      {errors.length > 0 && <ErrorList errors={errors} />}
      {files.length > 0 && <UploadedFilesList files={files} cleanedData={cleanedData} errors={errors} onRemove={removeFile} onExport={exportCleanedData} show={showUploadedFiles} onToggle={setShowUploadedFiles} />}
      {Object.keys(cleanedData).length > 0 && <AnalyticsControls showMetrics={showMetrics} setShowMetrics={setShowMetrics} showPortfolio={showPortfolio} setShowPortfolio={setShowPortfolio} showCorrelation={showCorrelation} setShowCorrelation={setShowCorrelation} />}
      {Object.keys(cleanedData).length > 0 && allPortfolioNames.length > 0 && (
        <PortfolioDropdown
          portfolioNames={allPortfolioNames}
          selectedNames={selectedPortfolioNames}
          onChange={setSelectedPortfolioNames}
        />
      )}
      {showPortfolio && portfolioFilteredAllMetrics && Object.keys(portfolioFilteredAllMetrics).length > 0 && <PortfolioSection allMetrics={portfolioFilteredAllMetrics} selectedTradeLists={selectedTradeLists} setSelectedTradeLists={setSelectedTradeLists} toggleSelection={toggleTradeListSelection} dateRange={dateRange} setDateRange={setDateRange} chartType={chartType} setChartType={setChartType} normalizeEquity={normalizeEquity} setNormalizeEquity={setNormalizeEquity} startingCapital={startingCapital} setStartingCapital={setStartingCapital} portfolioData={portfolioData} individualChartsData={individualChartsData} showMetrics={showMetrics} sortedAndFilteredMetrics={portfolioFilteredMetrics} contractMultipliers={contractMultipliers} handleContractChange={handleContractChange} masterContractValue={masterContractValue} setMasterContractValue={setMasterContractValue} applyMasterToAll={applyMasterToFiltered} sortConfig={sortConfig} handleSort={handleSort} sortPriorities={sortPriorities} showAdvancedSort={showAdvancedSort} setShowAdvancedSort={setShowAdvancedSort} addSortPriority={addSortPriority} removeSortPriority={removeSortPriority} updateSortPriority={updateSortPriority} clearSorting={clearSorting} applyAdvancedSort={applyAdvancedSort} onDeleteStrategy={handleDeleteStrategy} strategyIdMap={strategyIdMap} strategyAccountMap={strategyAccountMap} onUpdateAlias={onUpdateAlias} savedViews={savedViews} onSaveView={savePortfolioView} onLoadView={loadPortfolioView} />}
      {showCorrelation && portfolioFilteredAllMetrics && Object.keys(portfolioFilteredAllMetrics).length > 0 && <CorrelationSection selectedTradeLists={selectedTradeLists} dailyReturnsMap={dailyReturnsMap} correlationThreshold={correlationThreshold} setCorrelationThreshold={setCorrelationThreshold} correlationMatrix={correlationMatrix} correlationCalculating={correlationCalculating} onExport={exportCorrelationData} allMetrics={portfolioFilteredAllMetrics} />}
      {showMetrics && !showPortfolio && Object.keys(cleanedData).length > 0 && allMetrics && Object.keys(allMetrics).length > 0 && <MetricsTable sortedAndFilteredMetrics={portfolioFilteredMetrics} selectedTradeLists={selectedTradeLists} setSelectedTradeLists={setSelectedTradeLists} toggleSelection={toggleTradeListSelection} contractMultipliers={contractMultipliers} handleContractChange={handleContractChange} masterContractValue={masterContractValue} setMasterContractValue={setMasterContractValue} applyMasterToAll={applyMasterToFiltered} sortConfig={sortConfig} handleSort={handleSort} sortPriorities={sortPriorities} showAdvancedSort={showAdvancedSort} setShowAdvancedSort={setShowAdvancedSort} addSortPriority={addSortPriority} removeSortPriority={removeSortPriority} updateSortPriority={updateSortPriority} clearSorting={clearSorting} applyAdvancedSort={applyAdvancedSort} onDeleteStrategy={handleDeleteStrategy} strategyIdMap={strategyIdMap} strategyAccountMap={strategyAccountMap} onUpdateAlias={onUpdateAlias} />}
      {Object.keys(cleanedData).length > 0 && <SessionComplete />}
    </div>
  );
};

export default App;
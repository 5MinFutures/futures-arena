import { useState, useCallback, useEffect } from 'react';
import { supabase } from './supabaseClient';
import ButtonSection from './components/ButtonSection.tsx';
import Header from './components/Header.tsx';
import UploadSection from './components/UploadSection.tsx';
import ErrorList from './components/ErrorList.tsx';
import UploadedFilesList from './components/UploadedFilesList.tsx';
import AnalyticsControls from './components/AnalyticsControls.tsx';
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

const App = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [cleanedData, setCleanedData] = useState<CleanedData>({});
  const [processing, setProcessing] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showMetrics, setShowMetrics] = useState<boolean>(false);
  const [showPortfolio, setShowPortfolio] = useState<boolean>(false);
  const [showCorrelation, setShowCorrelation] = useState<boolean>(false);
  const [selectedTradeLists, setSelectedTradeLists] = useState<Set<string>>(new Set<string>());
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [chartType, setChartType] = useState<string>('equity');
  const [normalizeEquity, setNormalizeEquity] = useState<boolean>(false);
  const [startingCapital, setStartingCapital] = useState<number>(1000000);
  const [showUploadedFiles, setShowUploadedFiles] = useState<boolean>(false);
  const [correlationThreshold, setCorrelationThreshold] = useState<number>(0.5);
  const [correlationMatrix, setCorrelationMatrix] = useState<{ matrix: number[][]; strategies: string[]; size: number } | null>(null);
  const [correlationCalculating, setCorrelationCalculating] = useState<boolean>(false);

  const { contractMultipliers, masterContractValue, setMasterContractValue, handleContractChange, applyMasterToAll } = useContractMultipliers();
  const { sortConfig, sortPriorities, showAdvancedSort, setShowAdvancedSort, handleSort, addSortPriority, removeSortPriority, updateSortPriority, clearSorting, applyAdvancedSort } = useSorting();
  const { allMetrics, sortedAndFilteredMetrics } = useMetrics(cleanedData, contractMultipliers, sortConfig, sortPriorities);

  // Wrapper function to apply master contract value to only visible (filtered) rows
  const applyMasterToFiltered = useCallback((value: number) => {
    const visibleKeys = sortedAndFilteredMetrics.map(m => m.originalFilename);
    applyMasterToAll(value, visibleKeys);
  }, [sortedAndFilteredMetrics, applyMasterToAll]);
  const { portfolioData, individualChartsData, dailyReturnsMap } = usePortfolio(allMetrics || {}, selectedTradeLists, dateRange, normalizeEquity, startingCapital, contractMultipliers);

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

  // Dynamically load GoHighLevel iframe and script to avoid React DOM conflicts
  useEffect(() => {
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.5minfutures.com/widget/form/l3khVe6UJotvm6ZyPj1n';
    iframe.style.cssText = 'display:none;width:100%;height:100%;border:none;border-radius:3px';
    iframe.id = 'popup-l3khVe6UJotvm6ZyPj1n';
    iframe.setAttribute('data-layout', "{'id':'POPUP'}");
    iframe.setAttribute('data-trigger-type', 'showAfter');
    iframe.setAttribute('data-trigger-value', '10'); // Immediate display
    iframe.setAttribute('data-activation-type', 'alwaysActivated');
    iframe.setAttribute('data-activation-value', '');
    iframe.setAttribute('data-deactivation-type', 'leadCollected');
    iframe.setAttribute('data-deactivation-value', '');
    iframe.setAttribute('data-form-name', 'Trading Form ');
    iframe.setAttribute('data-height', '340');
    iframe.setAttribute('data-layout-iframe-id', 'popup-l3khVe6UJotvm6ZyPj1n');
    iframe.setAttribute('data-form-id', 'l3khVe6UJotvm6ZyPj1n');
    iframe.title = 'Trading Form ';
    document.body.appendChild(iframe);

    // Load script
    const script = document.createElement('script');
    script.src = 'https://www.5minfutures.com/js/form_embed.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

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

  const fetchFromSupabase = async () => {
    setProcessing(true);
    setErrors([]);

    try {
      // Fetch strategies (without embedded trades to avoid nested query limits)
      const { data: strategies, error: strategiesError } = await supabase
        .from('strategies')
        .select(`
          strategy_id,
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

      // Fetch trades for each strategy separately to avoid embedded resource limits
      for (const strategy of strategies) {
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
        strategy.trades = trades || [];
      }

      // Transform database data to cleanedData format
      const newCleanedData: CleanedData = { ...cleanedData };
      const newFilenames: string[] = [];
      const fileErrors: string[] = [];

      for (const strategy of strategies) {
        try {
          if (!strategy.trades || strategy.trades.length === 0) {
            fileErrors.push(`No trades found for strategy: ${strategy.strategy_id}`);
            continue;
          }

          // Build filename from metadata
          const filename = buildFilenameFromMetadata(strategy) + '.csv';

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
      setCleanedData(newCleanedData);

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

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-7xl">
      <ButtonSection onFetchSupabase={fetchFromSupabase} processing={processing} />
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
      {showPortfolio && allMetrics && Object.keys(allMetrics).length > 0 && <PortfolioSection allMetrics={allMetrics} selectedTradeLists={selectedTradeLists} setSelectedTradeLists={setSelectedTradeLists} toggleSelection={toggleTradeListSelection} dateRange={dateRange} setDateRange={setDateRange} chartType={chartType} setChartType={setChartType} normalizeEquity={normalizeEquity} setNormalizeEquity={setNormalizeEquity} startingCapital={startingCapital} setStartingCapital={setStartingCapital} portfolioData={portfolioData} individualChartsData={individualChartsData} showMetrics={showMetrics} sortedAndFilteredMetrics={sortedAndFilteredMetrics} contractMultipliers={contractMultipliers} handleContractChange={handleContractChange} masterContractValue={masterContractValue} setMasterContractValue={setMasterContractValue} applyMasterToAll={applyMasterToFiltered} sortConfig={sortConfig} handleSort={handleSort} sortPriorities={sortPriorities} showAdvancedSort={showAdvancedSort} setShowAdvancedSort={setShowAdvancedSort} addSortPriority={addSortPriority} removeSortPriority={removeSortPriority} updateSortPriority={updateSortPriority} clearSorting={clearSorting} applyAdvancedSort={applyAdvancedSort} />}
      {showCorrelation && allMetrics && Object.keys(allMetrics).length > 0 && <CorrelationSection selectedTradeLists={selectedTradeLists} dailyReturnsMap={dailyReturnsMap} correlationThreshold={correlationThreshold} setCorrelationThreshold={setCorrelationThreshold} correlationMatrix={correlationMatrix} correlationCalculating={correlationCalculating} onExport={exportCorrelationData} allMetrics={allMetrics} />}
      {showMetrics && !showPortfolio && Object.keys(cleanedData).length > 0 && allMetrics && Object.keys(allMetrics).length > 0 && <MetricsTable sortedAndFilteredMetrics={sortedAndFilteredMetrics} selectedTradeLists={selectedTradeLists} setSelectedTradeLists={setSelectedTradeLists} toggleSelection={toggleTradeListSelection} contractMultipliers={contractMultipliers} handleContractChange={handleContractChange} masterContractValue={masterContractValue} setMasterContractValue={setMasterContractValue} applyMasterToAll={applyMasterToFiltered} sortConfig={sortConfig} handleSort={handleSort} sortPriorities={sortPriorities} showAdvancedSort={showAdvancedSort} setShowAdvancedSort={setShowAdvancedSort} addSortPriority={addSortPriority} removeSortPriority={removeSortPriority} updateSortPriority={updateSortPriority} clearSorting={clearSorting} applyAdvancedSort={applyAdvancedSort} />}
      {Object.keys(cleanedData).length > 0 && <SessionComplete />}
    </div>
  );
};

export default App;
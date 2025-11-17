// src/utils/dataUtils.ts
import { marginRates } from './constants';

interface TradeData {
  date: Date;
  equity: number;
  cumEquity: number;
  tradeList?: string;
}

interface Metrics {
  filename: string;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  averageTrade: number;
  winRate: number;
  expectedValue: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  margin: number;
  startDate: Date;
  endDate: Date;
  tradeData: TradeData[];
  processedData: TradeData[];
  symbol: string;
  direction: string;
  intradayStatus: string | null;
  strategyName: string;
  isBenchmark: boolean;
  isFutures: boolean;
  originalFilename: string;
  [key: string]: any;
}

interface DatabaseTrade {
  trade_date: string;
  trade_time: string;
  profit: number;
  trade_type?: string | null;
  notes?: string | null;
}

interface StrategyMetadata {
  strategy_id: string;
  market: string;
  direction: string;
  strategy_name: string;
  display_name?: string;
  portfolio_hint?: string | null;
  is_intraday: boolean;
  contract_multiplier: number;
  margin_required?: number | null;
  is_benchmark: boolean;
}

export const normalizeDate = (date: string | Date | null): Date | null => {
  if (!date) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const getDateKey = (date: string | Date | null): string | null => {
  const normalized = normalizeDate(date);
  return normalized ? normalized.toISOString().split('T')[0] : null;
};

export const getAdjustedMetrics = (originalMetrics: Metrics | null, contractMultiplier: number = 1.0): Metrics | null => {
  if (!originalMetrics) return originalMetrics;
  if (contractMultiplier === 1.0) return originalMetrics;
  const multipliedFields = ['netProfit', 'averageWin', 'averageLoss', 'maxDrawdown', 'expectedValue', 'margin'];
  const adjustedMetrics: Metrics = { ...originalMetrics };
  multipliedFields.forEach(field => {
    if (typeof adjustedMetrics[field] === 'number') {
      adjustedMetrics[field] = adjustedMetrics[field] * contractMultiplier;
    }
  });
  if (originalMetrics.tradeData) {
    adjustedMetrics.tradeData = originalMetrics.tradeData.map(trade => ({
      ...trade,
      equity: trade.equity * contractMultiplier,
      cumEquity: trade.cumEquity * contractMultiplier
    }));
  }
  return adjustedMetrics;
};

export const getMarginRate = (symbolString: string | null, filename: string | null = null, processedData: TradeData[] | null = null): number => {
  if (!symbolString) return 0;
  const isBenchmark = filename ? filename.toLowerCase().includes('_benchmark') : false;
  if (isBenchmark && filename) {
    const baseName = filename.replace('.csv', '');
    const mainSymbol = baseName.split('_')[0].toUpperCase();
    if (mainSymbol in marginRates) {
      let marginRate = marginRates[mainSymbol as keyof typeof marginRates];
      if (filename.toUpperCase().includes('DTH')) {
        marginRate = marginRate / 10;
      }
      return marginRate;
    } else {
      if (processedData && processedData.length > 0) {
        const lastTrade = processedData[processedData.length - 1];
        return Math.abs(lastTrade.cumEquity);
      }
      return 0;
    }
  }
  const tradeLists = symbolString.split(', ');
  let totalMarginRate = 0;
  for (const tradeList of tradeLists) {
    const symbol = tradeList.split('_')[0].toUpperCase();
    if (symbol in marginRates) {
      let marginRate = marginRates[symbol as keyof typeof marginRates];
      const checkName = filename || tradeList;
      if (checkName && checkName.toUpperCase().includes('DTH')) {
        marginRate = marginRate / 10;
      }
      totalMarginRate += marginRate;
    }
  }
  return totalMarginRate;
};

export const formatNumber = (value: number | string): string => {
  if (typeof value !== 'number' || isNaN(value)) return value as string;
  if (Math.abs(value) >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (Math.abs(value) >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  } else {
    return `$${value.toFixed(2)}`;
  }
};

export const classifyBenchmarkFile = (filename: string | null): { isBenchmark: boolean; symbol: string | null; isFutures: boolean } => {
  if (!filename || !filename.toLowerCase().includes('_benchmark')) {
    return { isBenchmark: false, symbol: null, isFutures: false };
  }
  const baseName = filename.replace('.csv', '');
  const symbol = baseName.split('_')[0].toUpperCase();
  return {
    isBenchmark: true,
    symbol: symbol,
    isFutures: symbol in marginRates
  };
};

export const parseFilenameComponents = (filename: string | null): {
  symbol: string;
  direction: string;
  intradayStatus: string | null;
  strategyName: string;
  isBenchmark: boolean;
  isFutures: boolean;
} => {
  if (!filename) return { symbol: '', direction: 'Unknown', intradayStatus: null, strategyName: filename || '', isBenchmark: false, isFutures: false };
  const baseName = filename.replace('.csv', '');
  const isBenchmark = baseName.toLowerCase().includes('_benchmark');
  let symbol = '';
  let remaining = baseName;
  if (isBenchmark) {
    const parts = baseName.split('_');
    symbol = parts[0]?.toUpperCase() || '';
    remaining = parts.slice(1).join('_');
  } else {
    const parts = baseName.split('_');
    const firstPart = parts[0]?.toUpperCase();
    if (firstPart && firstPart in marginRates) {
      symbol = firstPart;
      remaining = parts.slice(1).join('_');
    }
  }
  let direction = 'Unknown';
  if (remaining.toUpperCase().includes('LONG')) {
    direction = 'Long';
    remaining = remaining.replace(/LONG/gi, '').replace(/^_+|_+$/g, '');
  } else if (remaining.toUpperCase().includes('SHORT')) {
    direction = 'Short';
    remaining = remaining.replace(/SHORT/gi, '').replace(/^_+|_+$/g, '');
  }
  let intradayStatus = null;
  if (remaining.toUpperCase().includes('DTH')) {
    intradayStatus = 'DTH';
    remaining = remaining.replace(/DTH/gi, '').replace(/^_+|_+$/g, '');
  }
  let strategyName;
  if (isBenchmark) {
    strategyName = symbol || 'Unknown';
  } else {
    strategyName = remaining.replace(/^_+|_+$/g, '').replace(/_+/g, '_') || 'Unknown Strategy';
  }
  return {
    symbol: symbol || 'Unknown',
    direction,
    intradayStatus,
    strategyName,
    isBenchmark,
    isFutures: false
  };
};

export const getDisplayName = (metrics: Metrics | null): string => {
  const name = metrics?.strategyName || metrics?.originalFilename?.replace('.csv', '') || 'Unknown';
  return metrics?.isBenchmark ? `_${name}` : name;
};

export const calculateMetrics = (data: { header: string[]; data: (string | number)[][] }, filename: string): Metrics | null => {
  if (!data.data || data.data.length === 0) {
    return null;
  }
  const benchmarkInfo = classifyBenchmarkFile(filename);
  const header = data.header;
  const cumEquityIndex = header.findIndex(col => col && col.includes('Cum Net Profit'));
  const dateIndex = header.findIndex(col => col && col.includes('Date/Time'));
  const profitLossIndex = header.findIndex(col => col && col.includes('Profit/Loss'));
  if (cumEquityIndex === -1) {
    return null;
  }

  // Auto-detect format: 2-row (CSV with Entry/Exit) vs 1-row (database single-row)
  const hasEntryExitColumn = header.some(col => col && col.includes('Entry/Exit'));

  const processedData: TradeData[] = [];
  const tradeData: TradeData[] = [];

  if (hasEntryExitColumn) {
    // OLD FORMAT: 2 rows per trade (entry + exit pairs)
    for (let i = 0; i < data.data.length - 1; i += 2) {
      const entryRow = data.data[i];
      const exitRow = data.data[i + 1];
      if (entryRow && exitRow &&
        entryRow.length > Math.max(cumEquityIndex, dateIndex) &&
        exitRow.length > Math.max(cumEquityIndex, dateIndex)) {
        const date = exitRow[dateIndex] as string;
        const entryEquityValue = entryRow[cumEquityIndex];
        const exitEquityValue = exitRow[cumEquityIndex];
        if (entryEquityValue && exitEquityValue &&
          !entryEquityValue.toString().toLowerCase().includes('n/a') &&
          !exitEquityValue.toString().toLowerCase().includes('n/a')) {
          const tradeEquity = typeof entryEquityValue === 'number' ? entryEquityValue : parseFloat(entryEquityValue as string) || 0;
          const cumEquity = typeof exitEquityValue === 'number' ? exitEquityValue : parseFloat(exitEquityValue as string) || 0;
          processedData.push({
            date: new Date(date),
            equity: tradeEquity,
            cumEquity
          });
          tradeData.push({
            date: new Date(date),
            equity: tradeEquity,
            cumEquity,
            tradeList: filename.replace('.csv', '')
          });
        }
      }
    }
  } else {
    // NEW FORMAT: 1 row per trade (database single-row format)
    for (let i = 0; i < data.data.length; i++) {
      const row = data.data[i];
      if (row && row.length > Math.max(cumEquityIndex, dateIndex, profitLossIndex)) {
        const date = row[dateIndex] as string;
        const profitValue = row[profitLossIndex];
        const cumEquityValue = row[cumEquityIndex];

        if (profitValue !== undefined && cumEquityValue !== undefined &&
          !profitValue.toString().toLowerCase().includes('n/a') &&
          !cumEquityValue.toString().toLowerCase().includes('n/a')) {
          const profit = typeof profitValue === 'number' ? profitValue : parseFloat(profitValue as string) || 0;
          const cumEquity = typeof cumEquityValue === 'number' ? cumEquityValue : parseFloat(cumEquityValue as string) || 0;

          processedData.push({
            date: new Date(date),
            equity: profit,
            cumEquity
          });
          tradeData.push({
            date: new Date(date),
            equity: profit,
            cumEquity,
            tradeList: filename.replace('.csv', '')
          });
        }
      }
    }
  }
  if (processedData.length === 0) {
    return null;
  }
  const netProfit = processedData[processedData.length - 1].cumEquity;
  const grossProfit = processedData.filter(d => d.equity > 0).reduce((sum, d) => sum + d.equity, 0);
  const grossLoss = processedData.filter(d => d.equity < 0).reduce((sum, d) => sum + d.equity, 0);
  const profitFactor = grossLoss !== 0 ? Math.abs(grossProfit / grossLoss) : Infinity;
  const winningTrades = processedData.filter(d => d.equity > 0).length;
  const totalTrades = processedData.length;
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
  const wins = processedData.filter(d => d.equity > 0).map(d => d.equity);
  const losses = processedData.filter(d => d.equity < 0).map(d => d.equity);
  const averageWin = wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0;
  const averageLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;
  const averageTrade = totalTrades > 0 ? netProfit / totalTrades : 0;
  let maxDrawdown = 0;
  let peak = 0;
  for (const trade of processedData) {
    if (trade.cumEquity > peak) {
      peak = trade.cumEquity;
    }
    const drawdown = peak - trade.cumEquity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  const expectedValue = (winRate * averageWin) - ((1 - winRate) * Math.abs(averageLoss));
  const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses) : 0;
  const symbol = filename.replace('.csv', '').split('_')[0];
  let margin: number;
  if (benchmarkInfo.isBenchmark && !benchmarkInfo.isFutures) {
    if (processedData.length > 0) {
      const lastTrade = processedData[processedData.length - 1];
      margin = Math.abs(lastTrade.cumEquity);
    } else {
      margin = 0;
    }
  } else {
    margin = getMarginRate(symbol, filename, processedData);
  }
  const filenameComponents = parseFilenameComponents(filename);
  return {
    filename: filename.replace('.csv', ''),
    netProfit,
    grossProfit,
    grossLoss,
    profitFactor,
    averageWin,
    averageLoss,
    averageTrade,
    winRate: winRate * 100,
    expectedValue,
    largestWin,
    largestLoss,
    maxDrawdown,
    totalTrades,
    winningTrades,
    losingTrades: totalTrades - winningTrades,
    margin,
    startDate: processedData[0].date,
    endDate: processedData[processedData.length - 1].date,
    tradeData,
    processedData,
    ...filenameComponents,
    originalFilename: filename
  };
};

export const getColorForIndex = (index: number): string => {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];
  return colors[index % colors.length];
};

export const parseCSV = (content: string): { header: string[]; data: string[][] } => {
  const allLines = content.split('\n');
  const isRawTradeStation = allLines.some(line => line.includes('TradeStation Trades List'));
  if (isRawTradeStation) {
    const header = parseCSVLine(allLines[4]);
    const data: string[][] = [];
    for (let i = 6; i < allLines.length; i++) {
      const line = allLines[i] ? allLines[i].trim() : '';
      if (!line) continue;
      if (line.includes('Trades List')) break;
      if (hasThreeConsecutiveCommas(line)) continue;
      const columns = parseCSVLine(line);
      if (columns.length > 0) {
        data.push(columns);
      }
    }
    return { header, data };
  } else {
    const lines = allLines.filter(line => line.trim());
    const header = parseCSVLine(lines[0]);
    const data: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.includes('Trades List')) break;
      const columns = parseCSVLine(line);
      if (columns.length > 0) {
        data.push(columns);
      }
    }
    return { header, data };
  }
};

export const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const hasThreeConsecutiveCommas = (line: string): boolean => {
  return line.includes(',,,');
};

export const cleanCurrencyValue = (value: string | number | null): number | string | null => {
  if (!value || typeof value !== 'string') return value;
  let cleaned = value.replace(/[$,]/g, '');
  const parenMatch = cleaned.match(/^\((.*)\)$/);
  if (parenMatch) {
    cleaned = '-' + parenMatch[1];
  }
  if (/^-?\d*\.?\d+$/.test(cleaned)) {
    return parseFloat(cleaned);
  }
  return value;
};

export const processCurrencyColumns = (data: (string | number)[][], header: string[]): (string | number)[][] => {
  const currencyColumns = [
    'Shares/Ctrts - Profit/Loss',
    'Net Profit - Cum Net Profit',
    'Profit/Loss',
    'Cum Net Profit'
  ];
  return data.map(row => {
    const processedRow = [...row];
    header.forEach((columnName, index) => {
      if (currencyColumns.some(col => columnName && columnName.includes(col))) {
        processedRow[index] = cleanCurrencyValue(processedRow[index] as string | number | null) as string | number;
      }
    });
    return processedRow;
  });
};

export const calculateRanks = (values: number[]): number[] => {
  const indexed = values.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);
  const ranks = new Array(values.length);
  let currentRank = 1;
  for (let i = 0; i < indexed.length; i++) {
    let tieCount = 1;
    while (i + tieCount < indexed.length && indexed[i + tieCount].val === indexed[i].val) {
      tieCount++;
    }
    const avgRank = currentRank + (tieCount - 1) / 2;
    for (let j = 0; j < tieCount; j++) {
      ranks[indexed[i + j].idx] = avgRank;
    }
    currentRank += tieCount;
    i += tieCount - 1;
  }
  return ranks;
};

export const calculatePearsonCorrelation = (x: number[], y: number[]): number => {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);
  const sumYY = y.reduce((sum, val) => sum + val * val, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  return denominator === 0 ? 0 : numerator / denominator;
};

export const calculateSpearmanCorrelation = (array1: number[], array2: number[]): number => {
  if (array1.length !== array2.length || array1.length < 3) {
    console.log('Correlation error: arrays length mismatch or too short', array1.length, array2.length);
    return 0;
  }
  console.log('Calculating correlation for arrays:');
  console.log('Array1:', array1.slice(0, 5), '... (length:', array1.length, ')');
  console.log('Array2:', array2.slice(0, 5), '... (length:', array2.length, ')');
  const ranks1 = calculateRanks(array1);
  const ranks2 = calculateRanks(array2);
  console.log('Ranks1:', ranks1.slice(0, 5), '...');
  console.log('Ranks2:', ranks2.slice(0, 5), '...');
  const correlation = calculatePearsonCorrelation(ranks1, ranks2);
  console.log('Final correlation result:', correlation.toFixed(4));
  return correlation;
};

export const buildCorrelationMatrix = (dailyReturnsMap: Map<string, number[]>, strategies: Set<string>): { matrix: number[][]; strategies: string[]; size: number } | null => {
  if (strategies.size < 2) return null;
  console.log('=== CORRELATION MATRIX DEBUG ===');
  console.log('Building matrix for strategies:', Array.from(strategies));
  const matrix: number[][] = [];
  const strategyNames = Array.from(strategies);
  for (let i = 0; i < strategyNames.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < strategyNames.length; j++) {
      if (i === j) {
        row.push(1.0);
      } else {
        const returns1 = dailyReturnsMap.get(strategyNames[i]) || [];
        const returns2 = dailyReturnsMap.get(strategyNames[j]) || [];
        console.log(`\n--- Correlating ${strategyNames[i]} vs ${strategyNames[j]} ---`);
        console.log(`Returns1 length: ${returns1.length}, Returns2 length: ${returns2.length}`);
        if (returns1.length > 0 && returns2.length > 0) {
          const correlation = calculateSpearmanCorrelation(returns1, returns2);
          console.log(`Final correlation ${strategyNames[i]} vs ${strategyNames[j]}: ${correlation.toFixed(4)}`);
          row.push(correlation);
        } else {
          console.log('No data available for correlation');
          row.push(0);
        }
      }
    }
    matrix.push(row);
  }
  return {
    matrix,
    strategies: strategyNames,
    size: strategyNames.length
  };
};

export const getSymbolPositionMargin = (filename: string | null): { symbol: string; position: string; margin: number; isBenchmark: boolean; isStockBenchmark: boolean } | null => {
  if (!filename) return null;
  const isBenchmark = filename.toLowerCase().includes('_benchmark');
  let symbol: string;
  let marginRate: number;
  if (isBenchmark) {
    symbol = filename.replace('.csv', '').split('_')[0].toUpperCase();
    if (symbol in marginRates) {
      marginRate = marginRates[symbol as keyof typeof marginRates];
      if (filename.toUpperCase().includes('DTH')) {
        marginRate = marginRate / 10;
      }
    } else {
      marginRate = 1; // Placeholder for stock benchmark
    }
  } else {
    symbol = filename.replace('.csv', '').split('_')[0].toUpperCase();
    if (!(symbol in marginRates)) return null;
    marginRate = marginRates[symbol as keyof typeof marginRates];
    if (filename.toUpperCase().includes('DTH')) {
      marginRate = marginRate / 10;
    }
  }
  const position = filename.toUpperCase().includes('LONG') ? 'Long' :
    filename.toUpperCase().includes('SHORT') ? 'Short' : 'Unknown';
  return {
    symbol,
    position,
    margin: marginRate,
    isBenchmark,
    isStockBenchmark: isBenchmark && !(symbol in marginRates)
  };
};

/**
 * Build filename from strategy metadata
 * Format: {market}_{direction}_{portfolio_hint}_{strategy_name}
 * Example: SI_Long_Test_TestStrategy1
 */
export const buildFilenameFromMetadata = (metadata: StrategyMetadata): string => {
  const parts = [
    metadata.market,
    metadata.direction,
    metadata.portfolio_hint,
    metadata.strategy_name
  ].filter(Boolean);  // Remove null/undefined values

  return parts.join('_');
};

/**
 * Calculate metrics from database trade records (single-row format)
 * Unlike CSV format which has entry/exit pairs, database has one row per trade
 *
 * @param trades - Array of trade objects from database
 * @param strategyMetadata - Strategy metadata from strategies table
 * @returns Metrics object matching calculateMetrics() format
 */
export const calculateMetricsFromDatabase = (
  trades: DatabaseTrade[],
  strategyMetadata: StrategyMetadata
): Metrics | null => {
  if (!trades || trades.length === 0) {
    return null;
  }

  // Build filename from strategy metadata (not parsing)
  const filename = buildFilenameFromMetadata(strategyMetadata);

  // Build processed data with cumulative equity
  const processedData: TradeData[] = [];
  const tradeData: TradeData[] = [];
  let cumEquity = 0;

  for (const trade of trades) {
    const datetime = `${trade.trade_date} ${trade.trade_time}`;
    const profit = typeof trade.profit === 'number' ? trade.profit : parseFloat(trade.profit as any) || 0;

    cumEquity += profit;

    processedData.push({
      date: new Date(datetime),
      equity: profit,
      cumEquity
    });

    tradeData.push({
      date: new Date(datetime),
      equity: profit,
      cumEquity,
      tradeList: filename
    });
  }

  // Calculate metrics (same logic as calculateMetrics)
  const netProfit = cumEquity;
  const grossProfit = processedData.filter(d => d.equity > 0).reduce((sum, d) => sum + d.equity, 0);
  const grossLoss = processedData.filter(d => d.equity < 0).reduce((sum, d) => sum + d.equity, 0);
  const profitFactor = grossLoss !== 0 ? Math.abs(grossProfit / grossLoss) : Infinity;

  const winningTrades = processedData.filter(d => d.equity > 0).length;
  const totalTrades = processedData.length;
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

  const wins = processedData.filter(d => d.equity > 0).map(d => d.equity);
  const losses = processedData.filter(d => d.equity < 0).map(d => d.equity);

  const averageWin = wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0;
  const averageLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;
  const averageTrade = totalTrades > 0 ? netProfit / totalTrades : 0;

  // Max drawdown calculation
  let maxDrawdown = 0;
  let peak = 0;
  for (const trade of processedData) {
    if (trade.cumEquity > peak) {
      peak = trade.cumEquity;
    }
    const drawdown = peak - trade.cumEquity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const expectedValue = (winRate * averageWin) - ((1 - winRate) * Math.abs(averageLoss));
  const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses) : 0;

  // Use margin from database, fallback to calculated value
  const margin = strategyMetadata.margin_required ||
                 getMarginRate(strategyMetadata.market, filename, processedData);

  return {
    filename,
    netProfit,
    grossProfit,
    grossLoss,
    profitFactor,
    averageWin,
    averageLoss,
    averageTrade,
    winRate: winRate * 100,
    expectedValue,
    largestWin,
    largestLoss,
    maxDrawdown,
    totalTrades,
    winningTrades,
    losingTrades: totalTrades - winningTrades,
    margin,
    startDate: processedData[0].date,
    endDate: processedData[processedData.length - 1].date,
    tradeData,
    processedData,
    symbol: strategyMetadata.market,
    direction: strategyMetadata.direction,
    intradayStatus: strategyMetadata.is_intraday ? 'DTH' : null,
    strategyName: strategyMetadata.strategy_name,
    isBenchmark: strategyMetadata.is_benchmark,
    isFutures: strategyMetadata.market in marginRates,
    originalFilename: filename + '.csv'
  };
};
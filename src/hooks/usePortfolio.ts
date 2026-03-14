// src/hooks/usePortfolio.ts
import { useMemo } from 'react';
import { getDateKey, getDisplayName, getColorForIndex } from '../utils/dataUtils.ts';
import { differenceInCalendarDays } from 'date-fns';

const usePortfolio = (
  allMetrics: Record<string, any>,
  selectedTradeLists: Set<string>,
  dateRange: { start: string | null; end: string | null },
  normalizeEquity: boolean,
  startingCapital: number,
  contractMultipliers: Record<string, number>
) => {
  const portfolioData = useMemo(() => {
    if (selectedTradeLists.size === 0) return null;

    // Parse date range filters
    const filterStartDate = dateRange.start ? new Date(dateRange.start) : null;
    const filterEndDate = dateRange.end ? new Date(dateRange.end) : null;

    const allTrades: any[] = [];
    let totalMargin = 0;
    let startDate = new Date();
    let endDate = new Date(0);
    Array.from(selectedTradeLists).forEach(filename => {
      const metrics = allMetrics[filename];
      if (metrics && metrics.tradeData) {
        allTrades.push(...metrics.tradeData.map((trade: any) => ({
          ...trade,
          dateKey: getDateKey(trade.date)
        })));
        totalMargin += metrics.margin;
        if (metrics.startDate < startDate) startDate = metrics.startDate;
        if (metrics.endDate > endDate) endDate = metrics.endDate;
      }
    });
    allTrades.sort((a, b) => a.date - b.date);

    // Filter trades by date range
    const filteredTrades = allTrades.filter(trade => {
      if (filterStartDate && trade.date < filterStartDate) return false;
      if (filterEndDate && trade.date > filterEndDate) return false;
      return true;
    });

    const timeSeries: any[] = [];
    let cumEquity = startingCapital;
    let peak = startingCapital;
    let maxDrawdown = 0;
    let totalPnl = 0;
    let winningTradesCount = 0;
    let losingTradesCount = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalTrades = 0;

    // Group by date for daily aggregation if needed, but for equity curve, cumulative per trade date
    const equityByDate = new Map();
    filteredTrades.forEach(trade => {
      const key = getDateKey(trade.date);
      if (!equityByDate.has(key)) equityByDate.set(key, 0);
      equityByDate.set(key, equityByDate.get(key) + trade.equity);
      if (trade.equity > 0) {
        winningTradesCount++;
        totalWins += trade.equity;
      } else if (trade.equity < 0) {
        losingTradesCount++;
        totalLosses += trade.equity;
      }
      totalTrades++;
    });

    // Build time series
    equityByDate.forEach((dailyEquity, dateKey) => {
      cumEquity += dailyEquity;
      totalPnl += dailyEquity;
      if (cumEquity > peak) peak = cumEquity;
      const drawdown = peak - cumEquity;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      timeSeries.push({
        dateStr: dateKey,
        cumEquity,
        drawdown: -drawdown, // Negative for chart
        drawdownPercent: startingCapital > 0 ? (-drawdown / startingCapital) * 100 : 0
      });
    });

    // Calculate trading days based on unique dates in filtered trades
    // When no date range is set, uses all trades from earliest to latest
    const uniqueTradingDates = new Set(filteredTrades.map(trade => getDateKey(trade.date)));
    const tradingPeriodDays = uniqueTradingDates.size || 1;

    // Calculate calendar days for accurate annual growth rate
    // Uses actual calendar days between first and last trade (respects date range filters)
    const calendarDays = filteredTrades.length > 0
      ? differenceInCalendarDays(
          filteredTrades[filteredTrades.length - 1].date,
          filteredTrades[0].date
        ) || 1
      : 1;

    // Calculate annual growth rate or actual return based on period length
    // If less than 12 months, show actual return instead of annualizing
    const isAnnualized = calendarDays >= 365;
    const annualGrowthRate = isAnnualized
      ? (totalPnl / startingCapital / calendarDays) * 365 * 100  // Annualized for periods >= 12 months
      : (totalPnl / startingCapital) * 100;                      // Actual return for periods < 12 months
    const pnlDrawdownRatio = maxDrawdown !== 0 ? totalPnl / maxDrawdown : Infinity;
    const ddPercentStartingCapital = (maxDrawdown / startingCapital) * 100;
    const tradeWinRate = totalTrades > 0 ? (winningTradesCount / totalTrades) * 100 : 0;
    const averageWin = winningTradesCount > 0 ? totalWins / winningTradesCount : 0;
    const averageLoss = losingTradesCount > 0 ? totalLosses / losingTradesCount : 0;
    const expectedValue = (tradeWinRate / 100 * averageWin) - ((1 - tradeWinRate / 100) * Math.abs(averageLoss));

    return {
      timeSeries,
      metrics: {
        totalPnl,
        annualGrowthRate,
        isAnnualized,
        pnlDrawdownRatio,
        maxDrawdown,
        ddPercentStartingCapital,
        tradeWinRate,
        totalTrades,
        winningTradesCount,
        losingTradesCount,
        averageWin,
        averageLoss,
        expectedValue,
        totalMargin,
        tradingPeriodDays,
        selectedCount: selectedTradeLists.size
      }
    };
  }, [allMetrics, selectedTradeLists, dateRange, normalizeEquity, startingCapital, contractMultipliers]);

  const individualChartsData = useMemo(() => {
    // Parse date range filters
    const filterStartDate = dateRange.start ? new Date(dateRange.start) : null;
    const filterEndDate = dateRange.end ? new Date(dateRange.end) : null;

    const series = Array.from(selectedTradeLists).map((filename: string, index: number) => {
      const metrics = allMetrics[filename];
      // Guard: strategy may be absent from allMetrics when its account is filtered out
      if (!metrics) return null;

      // Filter processedData by date range
      const filteredData = metrics.processedData.filter((trade: any) => {
        if (filterStartDate && trade.date < filterStartDate) return false;
        if (filterEndDate && trade.date > filterEndDate) return false;
        return true;
      });

      // Recalculate cumulative equity for the filtered data
      let cumEquity = 0;
      const data = filteredData.map((trade: any) => {
        cumEquity += trade.equity;
        return {
          date: getDateKey(trade.date),
          cumEquity: normalizeEquity ? (cumEquity / metrics.margin) * 100 : cumEquity
        };
      });
      return { filename, name: getDisplayName(metrics), color: getColorForIndex(index), data };
    }).filter((s) => s !== null) as { filename: string; name: string; color: string; data: any[] }[];

    // Pre-build O(1) lookup maps per series — avoids O(n_dates) .find() in the merge loop
    const seriesMaps = series.map(s => {
      const m = new Map<string, number>();
      s.data.forEach((d: any) => m.set(d.date, d.cumEquity));
      return m;
    });

    const combinedData: any[] = [];
    // Merge all individual data by date, filling nulls for missing dates
    const allDates = new Set(series.flatMap(s => s.data.map((d: any) => d.date)));
    Array.from(allDates).sort().forEach(date => {
      const entry: any = { date };
      series.forEach((s, i) => {
        const val = seriesMaps[i].get(date);
        entry[s.name] = val !== undefined ? val : null;
      });
      combinedData.push(entry);
    });

    return { series, combinedData };
  }, [allMetrics, selectedTradeLists, normalizeEquity, dateRange]);

  const dailyReturnsMap = useMemo(() => {
    if (selectedTradeLists.size === 0) return new Map<string, number[]>();

    // Parse date range filters
    const filterStartDate = dateRange.start ? new Date(dateRange.start) : null;
    const filterEndDate = dateRange.end ? new Date(dateRange.end) : null;

    // Step 1: Collect ALL unique dates across ALL selected strategies
    const allDatesSet = new Set<string>();
    const strategyEquityByDate = new Map<string, Map<string, number>>();

    Array.from(selectedTradeLists).forEach(filename => {
      const metrics = allMetrics[filename];
      if (!metrics || !metrics.tradeData) return;

      const equityByDate = new Map<string, number>();
      metrics.tradeData.forEach((trade: any) => {
        // Filter by date range
        if (filterStartDate && trade.date < filterStartDate) return;
        if (filterEndDate && trade.date > filterEndDate) return;

        const key = getDateKey(trade.date);
        if (!key) return; // Skip if date key is null
        allDatesSet.add(key);
        if (!equityByDate.has(key)) equityByDate.set(key, 0);
        equityByDate.set(key, equityByDate.get(key) + trade.equity);
      });
      strategyEquityByDate.set(filename, equityByDate);
    });

    // Step 2: Create common sorted date array
    const commonDates = Array.from(allDatesSet).sort();

    if (commonDates.length === 0) return new Map<string, number[]>();

    // Step 3: Align each strategy's returns to the common date timeline
    const returnsMap = new Map<string, number[]>();

    Array.from(selectedTradeLists).forEach(filename => {
      const equityByDate = strategyEquityByDate.get(filename);
      if (!equityByDate) return;

      const alignedReturns: number[] = [];
      let cumEquity = 0;
      let prevCumEquity = 0;

      commonDates.forEach(date => {
        const dailyEquity = equityByDate.get(date) || 0;
        cumEquity += dailyEquity;

        // Calculate percentage return
        // If no previous equity, return is 0
        // Otherwise, calculate return as (change in equity / previous equity) * 100
        let returnPct = 0;
        if (prevCumEquity !== 0) {
          returnPct = ((cumEquity - prevCumEquity) / Math.abs(prevCumEquity)) * 100;
        } else if (dailyEquity !== 0) {
          // First trade - calculate return based on daily equity relative to starting capital
          // For correlation purposes, we'll use 0 for the first data point
          returnPct = 0;
        }

        alignedReturns.push(returnPct);
        prevCumEquity = cumEquity;
      });

      returnsMap.set(filename, alignedReturns);
    });

    return returnsMap;
  }, [allMetrics, selectedTradeLists, dateRange]);

  return { portfolioData, individualChartsData, dailyReturnsMap };
};

export default usePortfolio;
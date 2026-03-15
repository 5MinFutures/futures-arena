import { useState, useMemo, useRef } from 'react';
import { Calendar, DollarSign, ArrowRight } from 'lucide-react';
import MetricsTable from './MetricsTable';
import { Chart as ChartJS, LineController, LineElement, PointElement, CategoryScale, LinearScale, TimeScale, Tooltip, Legend, Filler } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns'; // For date handling
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { formatNumber } from '../utils/dataUtils';
import { useChartSync } from '../hooks/useChartSync';
import { ChartZoomControls } from './ChartZoomControls';

// Register Chart.js components and plugins
ChartJS.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, TimeScale, Tooltip, Legend, Filler, zoomPlugin, annotationPlugin);

interface TimeSeriesItem {
  dateStr: string;
  cumEquity: number;
  drawdown: number;
  drawdownPercent: number;
  // Add more properties as needed
}

interface PortfolioMetrics {
  totalPnl: number;
  annualGrowthRate: number;
  isAnnualized: boolean;
  pnlDrawdownRatio: number;
  maxDrawdown: number;
  ddPercentStartingCapital: number;
  tradeWinRate: number;
  totalTrades: number;
  winningTradesCount: number;
  losingTradesCount: number;
  averageWin: number;
  averageLoss: number;
  expectedValue: number;
  totalMargin: number;
  tradingPeriodDays: number;
  selectedCount: number;
  // Add more properties as needed
}

interface PortfolioData {
  timeSeries: TimeSeriesItem[];
  metrics: PortfolioMetrics;
}

interface IndividualSeriesItem {
  date: string;
  cumEquity: number;
  // Add more properties as needed
}

interface IndividualSeries {
  name: string;
  data: IndividualSeriesItem[];
  color: string;
}

interface IndividualChartsData {
  series: IndividualSeries[];
  combinedData: unknown[]; // Adjust if combinedData structure is known
}

interface PortfolioSectionProps {
  allMetrics: Record<string, Record<string, unknown>>;
  selectedTradeLists: Set<string>;
  setSelectedTradeLists: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelection: (filename: string) => void;
  dateRange: { start: string | null; end: string | null };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string | null; end: string | null }>>;
  chartType: string;
  setChartType: React.Dispatch<React.SetStateAction<string>>;
  normalizeEquity: boolean;
  setNormalizeEquity: React.Dispatch<React.SetStateAction<boolean>>;
  startingCapital: number;
  setStartingCapital: React.Dispatch<React.SetStateAction<number>>;
  portfolioData: PortfolioData | null;
  individualChartsData: IndividualChartsData;
  showMetrics: boolean;
  sortedAndFilteredMetrics: Record<string, unknown>[];
  contractMultipliers: { [key: string]: number };
  handleContractChange: (filename: string, value: number) => void;
  masterContractValue: string;
  setMasterContractValue: (value: string) => void;
  applyMasterToAll: (value: number) => void;
  sortConfig: { key: string | null; direction: 'asc' | 'desc' };
  handleSort: (key: string) => void;
  sortPriorities: { column: string; direction: 'asc' | 'desc' }[];
  showAdvancedSort: boolean;
  setShowAdvancedSort: (value: boolean) => void;
  addSortPriority: () => void;
  removeSortPriority: (index: number) => void;
  updateSortPriority: (index: number, field: 'column' | 'direction', value: string) => void;
  clearSorting: () => void;
  applyAdvancedSort: () => void;
  onDeleteStrategy: (filename: string) => void;
  strategyIdMap: Record<string, string>;
  strategyAccountMap: Record<string, string>;
  onUpdateAlias: (accountId: string, strategyId: string, names: { displayName?: string; portfolioDisplayName?: string }) => void;
  savedViews: Array<{ id: string; name: string; created_at: string }>;
  onSaveView: (name: string) => void;
  onLoadView: (id: string) => void;
  onDeleteView: (id: string) => void;
}

const PortfolioSection = ({
  allMetrics,
  selectedTradeLists,
  setSelectedTradeLists,
  toggleSelection,
  dateRange,
  setDateRange,
  chartType,
  setChartType,
  normalizeEquity,
  setNormalizeEquity,
  startingCapital,
  setStartingCapital,
  portfolioData,
  individualChartsData,
  showMetrics,
  sortedAndFilteredMetrics,
  contractMultipliers,
  handleContractChange,
  masterContractValue,
  setMasterContractValue,
  applyMasterToAll,
  sortConfig,
  handleSort,
  sortPriorities,
  showAdvancedSort,
  setShowAdvancedSort,
  addSortPriority,
  removeSortPriority,
  updateSortPriority,
  clearSorting,
  applyAdvancedSort,
  onDeleteStrategy,
  strategyIdMap,
  strategyAccountMap,
  onUpdateAlias,
  savedViews,
  onSaveView,
  onLoadView,
  onDeleteView,
}: PortfolioSectionProps) => {
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [viewName, setViewName] = useState('');
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [riskFreeRate, setRiskFreeRate] = useState<number>(4); // Default 4% annual risk-free rate

  // Calculate downside deviation for Sortino Ratio (annualized)
  const downsideDeviation = useMemo(() => {
    if (!portfolioData?.timeSeries || portfolioData.timeSeries.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < portfolioData.timeSeries.length; i++) {
      const prevEquity = portfolioData.timeSeries[i - 1].cumEquity;
      const currEquity = portfolioData.timeSeries[i].cumEquity;
      const dailyReturn = ((currEquity - prevEquity) / prevEquity) * 100;
      returns.push(dailyReturn);
    }

    // Calculate downside deviation (only negative returns)
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return 0;

    // BUG FIX #1: Divide by total returns count, not just negative returns count
    const sumSquaredNegativeReturns = negativeReturns.reduce((sum, r) => sum + r * r, 0);
    const downsideVariance = sumSquaredNegativeReturns / returns.length;
    const dailyDownsideDeviation = Math.sqrt(downsideVariance);

    // BUG FIX #2: Annualize the downside deviation to match annual returns
    const annualizedDownsideDeviation = dailyDownsideDeviation * Math.sqrt(365);

    return annualizedDownsideDeviation;
  }, [portfolioData]);

  // Calculate 12-month (trailing 365 days) return
  const twelveMonthReturn = useMemo(() => {
    if (!portfolioData?.timeSeries || portfolioData.timeSeries.length < 2) return 0;

    const endIndex = portfolioData.timeSeries.length - 1;
    const endEquity = portfolioData.timeSeries[endIndex].cumEquity;
    const endDate = new Date(portfolioData.timeSeries[endIndex].dateStr);

    // Find the equity value 365 days ago
    const targetDate = new Date(endDate);
    targetDate.setDate(targetDate.getDate() - 365);

    // Find closest data point to 365 days ago
    let startIndex = 0;
    for (let i = endIndex; i >= 0; i--) {
      const pointDate = new Date(portfolioData.timeSeries[i].dateStr);
      if (pointDate <= targetDate) {
        startIndex = i;
        break;
      }
    }

    const startEquity = portfolioData.timeSeries[startIndex].cumEquity;
    if (startEquity === 0) return 0;

    return ((endEquity - startEquity) / Math.abs(startEquity)) * 100;
  }, [portfolioData]);

  // Calculate max drawdown point for annotation
  const maxDrawdownPoint = useMemo(() => {
    if (!portfolioData?.timeSeries) return null;
    return portfolioData.timeSeries.reduce((max: TimeSeriesItem, point: TimeSeriesItem) =>
      point.drawdown < max.drawdown ? point : max, portfolioData.timeSeries[0] || {} as TimeSeriesItem);
  }, [portfolioData]);

  // Chart refs for synchronized zoom
  const equityChartRef = useRef<ChartJS<'line', { x: string; y: number }[], unknown>>(null);
  const drawdownChartRef = useRef<ChartJS<'line', { x: string; y: number }[], unknown>>(null);
  const individualChartRef = useRef<ChartJS<'line', { x: string; y: number }[], unknown>>(null);

  // Synchronized zoom hook
  const { onZoomCompleteHandler, onPanCompleteHandler, resetZoom, isZoomed } = useChartSync({
    equityChartRef,
    drawdownChartRef,
    individualChartRef
  });

  // Equity Chart Data
  const equityChartData = useMemo(() => {
    if (!portfolioData?.timeSeries) return { datasets: [] };
    return {
      datasets: [
        {
          label: 'Portfolio Equity',
          data: portfolioData.timeSeries.map(item => ({
            x: item.dateStr,
            y: normalizeEquity ? item.cumEquity : item.cumEquity,
          })),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    };
  }, [portfolioData, normalizeEquity]);

  // Drawdown Chart Data
  const drawdownChartData = useMemo(() => {
    if (!portfolioData?.timeSeries) return { datasets: [] };
    return {
      datasets: [
        {
          label: 'Drawdown',
          data: portfolioData.timeSeries.map(item => ({
            x: item.dateStr,
            y: normalizeEquity ? item.drawdownPercent : item.drawdown,
          })),
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.3)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    };
  }, [portfolioData, normalizeEquity]);

  // Individual Charts Data
  const individualChartData = useMemo(() => {
    if (!individualChartsData.series.length) return { datasets: [] };
    return {
      datasets: individualChartsData.series.map((series: IndividualSeries) => ({
        label: series.name,
        data: series.data.map((item: IndividualSeriesItem) => ({
          x: item.date,
          y: normalizeEquity ? item.cumEquity : item.cumEquity,
        })),
        borderColor: series.color,
        backgroundColor: `${series.color}33`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      })),
    };
  }, [individualChartsData, normalizeEquity]);

  // Common Chart Options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'day' as const,
          displayFormats: { day: 'MMM d, yyyy' },
        },
        ticks: {
          maxTicksLimit: 30,
          font: { size: 10 },
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          font: { size: 10 },
          callback: (value: any) => normalizeEquity ? `${value.toFixed(2)}%` : formatNumber(value),
        },
        grid: { color: '#e5e7eb' },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { font: { size: 10 }, color: '#1f2937' },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => `${context.dataset.label || ''}: ${normalizeEquity ? context.parsed.y.toFixed(2) + '%' : formatNumber(context.parsed.y)}`,
        },
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x' as const,
          onZoomComplete: onZoomCompleteHandler,
        },
        pan: {
          enabled: true,
          mode: 'x' as const,
          onPanComplete: onPanCompleteHandler,
        },
        limits: {
          x: { min: 'original' as const, max: 'original' as const },
        },
      },
      annotation: {
        annotations: maxDrawdownPoint && (chartType === 'drawdown' || chartType === 'both') ? [
          {
            type: 'line' as const,
            xMin: maxDrawdownPoint.dateStr,
            xMax: maxDrawdownPoint.dateStr,
            borderColor: '#EF4444',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: 'Max DD',
              position: 'center' as const,  // Changed to 'center' to match valid options
              backgroundColor: '#EF4444',
              color: '#ffffff',
              font: { size: 10 },
            },
          },
        ] : [],
      },
    },
  };

  // Drawdown-specific options (reversed Y-axis)
  const drawdownOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        reverse: true,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: (value: any) => normalizeEquity ? `${value.toFixed(2)}%` : formatNumber(value),
        },
      },
    },
  };

  return (
    <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
      {showMetrics && (
        <MetricsTable
          sortedAndFilteredMetrics={sortedAndFilteredMetrics}
          selectedTradeLists={selectedTradeLists}
          setSelectedTradeLists={setSelectedTradeLists}
          toggleSelection={toggleSelection}
          contractMultipliers={contractMultipliers}
          handleContractChange={handleContractChange}
          masterContractValue={masterContractValue}
          setMasterContractValue={setMasterContractValue}
          applyMasterToAll={applyMasterToAll}
          sortConfig={sortConfig}
          handleSort={handleSort}
          sortPriorities={sortPriorities}
          showAdvancedSort={showAdvancedSort}
          setShowAdvancedSort={setShowAdvancedSort}
          addSortPriority={addSortPriority}
          removeSortPriority={removeSortPriority}
          updateSortPriority={updateSortPriority}
          clearSorting={clearSorting}
          applyAdvancedSort={applyAdvancedSort}
          onDeleteStrategy={onDeleteStrategy}
          strategyIdMap={strategyIdMap}
          strategyAccountMap={strategyAccountMap}
          onUpdateAlias={onUpdateAlias}
        />
      )}
      {selectedTradeLists.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 sm:space-x-4">
              <div className="flex items-center gap-1 sm:gap-2 sm:space-x-2">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                <span className="text-xs sm:text-sm font-medium text-blue-800">Date Range:</span>
                <input
                  type="date"
                  value={dateRange.start || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="text-xs sm:text-sm px-1 sm:px-2 py-1 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                  aria-label="Start Date"
                />
                <span className="text-blue-600 text-xs sm:text-sm">to</span>
                <input
                  type="date"
                  value={dateRange.end || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="text-xs sm:text-sm px-1 sm:px-2 py-1 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                  aria-label="End Date"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 sm:space-x-3">
              <label className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <input
                  type="checkbox"
                  checked={normalizeEquity}
                  onChange={(e) => setNormalizeEquity(e.target.checked)}
                  className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 rounded"
                  aria-label="Normalize by Margin"
                />
                <span className="text-blue-800">Normalize by Margin</span>
              </label>
              <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                <span className="text-blue-800">Starting Capital:</span>
                <input
                  type="number"
                  value={startingCapital}
                  onChange={(e) => setStartingCapital(Number(e.target.value) || 1000000)}
                  className="w-20 sm:w-24 px-1 sm:px-2 py-1 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                  placeholder="1000000"
                  aria-label="Starting Capital"
                />
                {portfolioData && (
                  <button
                    onClick={() => setStartingCapital(portfolioData.metrics.totalMargin)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300 rounded transition-colors touch-manipulation"
                    aria-label="Set Starting Capital to Total Margin"
                    title="Set to Total Margin"
                  >
                    <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">Total Margin</span>
                  </button>
                )}
              </div>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                aria-label="Chart Type"
              >
                <option value="equity">Equity Curve</option>
                <option value="drawdown">Drawdown</option>
                <option value="both">Both Charts</option>
              </select>
            </div>
          </div>
        </div>
      )}
      {/* Saved Views */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={viewName}
          onChange={e => setViewName(e.target.value)}
          placeholder="View name..."
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
        <button
          onClick={() => { if (viewName.trim()) { onSaveView(viewName.trim()); setViewName(''); } }}
          disabled={!viewName.trim()}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
        >
          Save View
        </button>
        {savedViews.length > 0 && (
          <>
            <select
              value={selectedViewId}
              onChange={e => {
                const id = e.target.value;
                setSelectedViewId(id);
                if (id) {
                  onLoadView(id);
                  const view = savedViews.find(v => v.id === id);
                  if (view) setViewName(view.name);
                }
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700"
            >
              <option value="">Load saved view…</option>
              {savedViews.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (selectedViewId) {
                  onDeleteView(selectedViewId);
                  setSelectedViewId('');
                  setViewName('');
                }
              }}
              disabled={!selectedViewId}
              className="px-2 py-1 text-sm text-red-600 disabled:opacity-40"
              title="Delete selected view"
            >
              🗑
            </button>
          </>
        )}
      </div>
      {selectedTradeLists.size === 0 && (
        <div className="p-3 sm:p-4 bg-gray-100 border border-gray-200 rounded-lg text-center">
          <p className="text-xs sm:text-sm text-gray-600">Select at least one trading strategy from the metrics table to view portfolio analysis.</p>
        </div>
      )}
      {portfolioData && selectedTradeLists.size > 0 && portfolioData.timeSeries.length > 0 && (
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-blue-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            <div>
              <p className="text-xs text-blue-600 font-medium">Total Return</p>
              <p className={`text-base sm:text-lg font-bold ${portfolioData.metrics.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNumber(portfolioData.metrics.totalPnl)}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">
                {portfolioData.metrics.isAnnualized ? 'Annual Growth Rate' : (
                  <>
                    Total Return
                    <span className="ml-1 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-full">
                      &lt; 1 yr
                    </span>
                  </>
                )}
              </p>
              <p className={`text-base sm:text-lg font-bold ${portfolioData.metrics.annualGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioData.metrics.annualGrowthRate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">PNL/DD Ratio</p>
              <p className="text-base sm:text-lg font-bold text-blue-600">
                {portfolioData.metrics.pnlDrawdownRatio === Infinity ? '∞' : portfolioData.metrics.pnlDrawdownRatio.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Max Drawdown</p>
              <p className="text-base sm:text-lg font-bold text-red-600">{formatNumber(portfolioData.metrics.maxDrawdown)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">DD % of Capital</p>
              <p className="text-base sm:text-lg font-bold text-red-600">{portfolioData.metrics.ddPercentStartingCapital.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Win Rate</p>
              <p className="text-base sm:text-lg font-bold text-blue-600">{portfolioData.metrics.tradeWinRate.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Total Trades</p>
              <p className="text-base sm:text-lg font-bold text-blue-600">{portfolioData.metrics.totalTrades}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Winning Trades</p>
              <p className="text-base sm:text-lg font-bold text-green-600">{portfolioData.metrics.winningTradesCount}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Losing Trades</p>
              <p className="text-base sm:text-lg font-bold text-red-600">{portfolioData.metrics.losingTradesCount}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Average Win</p>
              <p className="text-base sm:text-lg font-bold text-green-600">{formatNumber(portfolioData.metrics.averageWin)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Average Loss</p>
              <p className="text-base sm:text-lg font-bold text-red-600">{formatNumber(portfolioData.metrics.averageLoss)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Expected Value</p>
              <p className={`text-base sm:text-lg font-bold ${portfolioData.metrics.expectedValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNumber(portfolioData.metrics.expectedValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Total Margin</p>
              <p className="text-base sm:text-lg font-bold text-blue-600">{formatNumber(portfolioData.metrics.totalMargin)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Trading Days</p>
              <p className="text-base sm:text-lg font-bold text-blue-600">{portfolioData.metrics.tradingPeriodDays}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Strategies</p>
              <p className="text-base sm:text-lg font-bold text-blue-600">{portfolioData.metrics.selectedCount}</p>
            </div>
          </div>
          <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h5 className="text-xs sm:text-sm font-medium text-blue-800">Advanced Metrics</h5>
              <button
                onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
                className="text-xs text-blue-600 hover:text-blue-800 px-1 sm:px-2 py-1 border border-blue-300 rounded hover:bg-blue-100"
                aria-label={showAdvancedMetrics ? 'Hide Advanced Metrics' : 'Show Advanced Metrics'}
              >
                {showAdvancedMetrics ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            {showAdvancedMetrics && (
              <div className="text-xs text-blue-700 space-y-2 mt-2">
                <div className="bg-white p-2 rounded border border-blue-200">
                  <label className="flex items-center gap-2">
                    <strong>Risk-Free Rate (%):</strong>
                    <input
                      type="number"
                      value={riskFreeRate}
                      onChange={(e) => setRiskFreeRate(Number(e.target.value))}
                      min="0"
                      max="10"
                      step="0.1"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900"
                    />
                  </label>
                </div>
                <p><strong>Portfolio Composition:</strong> {Array.from(selectedTradeLists).map(filename => allMetrics[filename]?.strategyName || filename.replace('.csv', '')).join(', ')}</p>
                <p><strong>Start Date:</strong> {portfolioData.timeSeries[0]?.dateStr || 'N/A'}</p>
                <p><strong>End Date:</strong> {portfolioData.timeSeries[portfolioData.timeSeries.length - 1]?.dateStr || 'N/A'}</p>
                <p><strong>Average Trade:</strong> {formatNumber(portfolioData.metrics.totalPnl / (portfolioData.metrics.totalTrades || 1))}</p>
                <p><strong>Sharpe Ratio:</strong> {((portfolioData.metrics.annualGrowthRate / 100) / (portfolioData.metrics.maxDrawdown / startingCapital)).toFixed(2)}</p>
                <p>
                  <strong>Sortino Ratio:</strong> {
                    downsideDeviation > 0
                      ? ((portfolioData.metrics.annualGrowthRate - riskFreeRate) / downsideDeviation).toFixed(2)
                      : 'N/A'
                  }
                  {downsideDeviation > 0 && <span className="text-gray-500 ml-1">(Annualized Downside Dev: {downsideDeviation.toFixed(2)}%)</span>}
                </p>
                <p><strong>12-Month Return:</strong> {twelveMonthReturn.toFixed(2)}%</p>
              </div>
            )}
          </div>
        </div>
      )}
      {portfolioData && selectedTradeLists.size > 0 && portfolioData.timeSeries.length === 0 && (
        <div className="p-3 sm:p-4 bg-red-100 border border-red-200 rounded-lg text-center">
          <p className="text-xs sm:text-sm text-red-600">No valid data available for the selected strategies. Please check your data or selections.</p>
        </div>
      )}
      {portfolioData && selectedTradeLists.size > 0 && portfolioData.timeSeries.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <ChartZoomControls
            isZoomed={isZoomed}
            onReset={resetZoom}
          />
          {(chartType === 'equity' || chartType === 'both') && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <h4 className="font-medium text-gray-800 mb-3 sm:mb-4 text-sm sm:text-base">
                Portfolio Equity Curve {normalizeEquity && '(% of Margin)'}
              </h4>
              <div style={{ height: '300px' }} className="min-h-[200px] sm:min-h-[300px]" aria-label="Portfolio Equity Curve">
                <Chart ref={equityChartRef} type="line" data={equityChartData} options={chartOptions} />
              </div>
            </div>
          )}
          {(chartType === 'drawdown' || chartType === 'both') && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <h4 className="font-medium text-gray-800 mb-3 sm:mb-4 text-sm sm:text-base">
                Portfolio Drawdown {normalizeEquity && '(% of Margin)'}
              </h4>
              <div style={{ height: '250px' }} className="min-h-[150px] sm:min-h-[250px]" aria-label="Portfolio Drawdown">
                <Chart ref={drawdownChartRef} type="line" data={drawdownChartData} options={drawdownOptions} />
              </div>
            </div>
          )}
          {individualChartsData.series.length >= 1 && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <h4 className="font-medium text-gray-800 mb-3 sm:mb-4 text-sm sm:text-base">
                Individual Trade List Performance {normalizeEquity && '(% of Margin)'}
              </h4>
              <div style={{ height: '300px' }} className="min-h-[200px] sm:min-h-[300px]" aria-label="Individual Trade List Performance">
                <Chart ref={individualChartRef} type="line" data={individualChartData} options={chartOptions} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PortfolioSection;
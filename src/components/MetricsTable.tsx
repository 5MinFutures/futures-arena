import { TrendingUp, Settings, Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import MasterContractControl from './MasterContractControl';
import SortableHeader from './SortableHeader.tsx';
import ContractInput from './ContractInput.tsx';
import { sortableColumns } from '../utils/constants.ts';
import { getDisplayName, formatNumber } from '../utils/dataUtils.ts';

interface MetricsTableProps {
  sortedAndFilteredMetrics: any[];
  selectedTradeLists: Set<string>;
  setSelectedTradeLists: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelection: (filename: string) => void;
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
}

const MetricsTable = ({
  sortedAndFilteredMetrics,
  selectedTradeLists,
  setSelectedTradeLists,
  toggleSelection,
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
  updateSortPriority,
  clearSorting,
  applyAdvancedSort,
  onDeleteStrategy,
  strategyIdMap
}: MetricsTableProps) => {
  return (
    <div className="mb-4 sm:mb-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2" />
            <h4 className="text-green-800 font-medium text-sm sm:text-base">Individual Trade List Metrics ({sortedAndFilteredMetrics.length} trade lists)</h4>
          </div>
          <div className="flex items-center gap-2 sm:space-x-2">
            <button onClick={() => setShowAdvancedSort(!showAdvancedSort)} className="flex items-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 px-2 sm:px-3 py-1 border border-blue-300 rounded-md hover:bg-blue-50">
              <Settings className="h-3 w-3 mr-1" /> Advanced Sort
            </button>
            {(sortPriorities.length > 0 || sortConfig.key) && <button onClick={clearSorting} className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50">Clear Sorting</button>}
          </div>
        </div>
        {showAdvancedSort && (
          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-white border border-gray-900 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 sm:mb-3 gap-2">
              <h5 className="font-medium text-gray-800 text-sm sm:text-base">Multi-Column Sorting</h5>
              <button
                onClick={addSortPriority}
                className="flex items-center text-xs sm:text-sm text-green-600 hover:text-green-800 px-2 py-1 border border-green-300 rounded hover:bg-green-50"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Sort
              </button>
            </div>
            {sortPriorities.length === 0 && (
              <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                Add sorting criteria to sort by multiple columns in priority order.
              </p>
            )}
            {sortPriorities.map((priority: { column: string; direction: 'asc' | 'desc' }, index: number) => (
              <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:space-x-2 mb-2">
                <span className="text-xs sm:text-sm text-gray-600 w-12">#{index + 1}</span>
                <select
                  value={priority.column}
                  onChange={(e) => updateSortPriority(index, 'column', e.target.value)}
                  className="flex-1 text-xs sm:text-sm border border-gray-300 rounded px-1 sm:px-2 py-1 focus:outline-none focus:border-blue-400"
                >
                  {sortableColumns.map(col => (
                    <option key={col.key} value={col.key}>{col.label}</option>
                  ))}
                </select>
                <select
                  value={priority.direction}
                  onChange={(e) => updateSortPriority(index, 'direction', e.target.value)}
                  className="text-xs sm:text-sm border border-gray-300 rounded px-1 sm:px-2 py-1 focus:outline-none focus:border-blue-400"
                >
                  <option value="asc">Low to High</option>
                  <option value="desc">High to Low</option>
                </select>
              </div>
            ))}
            {sortPriorities.length > 0 && (
              <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-900 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={applyAdvancedSort}
                  className="text-xs sm:text-sm bg-blue-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded hover:bg-blue-700 mr-0 sm:mr-2"
                >
                  Apply Sorting
                </button>
                <button
                  onClick={() => setShowAdvancedSort(false)}
                  className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 px-2 sm:px-3 py-1 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-900 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-700 border-b cursor-pointer hover:bg-gray-100">
                <div className="flex items-center gap-1 sm:space-x-1">
                  <input
                    type="checkbox"
                    checked={sortedAndFilteredMetrics.every(metrics => selectedTradeLists.has(metrics.originalFilename)) && sortedAndFilteredMetrics.length > 0}
                    onChange={() => {
                      if (sortedAndFilteredMetrics.every(metrics => selectedTradeLists.has(metrics.originalFilename))) {
                        // Deselect all
                        setSelectedTradeLists(prev => {
                          const newSet = new Set(prev);
                          sortedAndFilteredMetrics.forEach(metrics => {
                            newSet.delete(metrics.originalFilename);
                          });
                          return newSet;
                        });
                      } else {
                        // Select all
                        setSelectedTradeLists(prev => {
                          const newSet = new Set(prev);
                          sortedAndFilteredMetrics.forEach(metrics => {
                            newSet.add(metrics.originalFilename);
                          });
                          return newSet;
                        });
                      }
                    }}
                    className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span 
                    onClick={() => handleSort('_selected')}
                    className="cursor-pointer text-xs sm:text-sm"
                  >
                    Select
                    {sortConfig.key === '_selected' && (
                      sortConfig.direction === 'asc' ?
                        <ChevronUp className="h-3 w-3 inline ml-1" /> :
                        <ChevronDown className="h-3 w-3 inline ml-1" />
                    )}
                  </span>
                </div>
              </th>
              <SortableHeader column="portfolioHint" sortConfig={sortConfig} handleSort={handleSort}>Portfolio</SortableHeader>
              <SortableHeader column="strategyName" sortConfig={sortConfig} handleSort={handleSort}>Strategy</SortableHeader>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                <div className="flex flex-col gap-1 sm:space-y-1">
                  <span>Contracts</span>
                  <MasterContractControl 
                    masterValue={masterContractValue} 
                    onMasterValueChange={setMasterContractValue} 
                    onApplyToAll={applyMasterToAll} 
                  />
                </div>
              </th>
              <SortableHeader column="symbol" sortConfig={sortConfig} handleSort={handleSort}>Symbol</SortableHeader>
              <SortableHeader column="direction" sortConfig={sortConfig} handleSort={handleSort}>Direction</SortableHeader>
              <SortableHeader column="intradayStatus" sortConfig={sortConfig} handleSort={handleSort}>DTH</SortableHeader>
              <SortableHeader column="netProfit" sortConfig={sortConfig} handleSort={handleSort}>Net Profit</SortableHeader>
              <SortableHeader column="profitFactor" sortConfig={sortConfig} handleSort={handleSort}>Profit Factor</SortableHeader>
              <SortableHeader column="winRate" sortConfig={sortConfig} handleSort={handleSort}>Win Rate</SortableHeader>
              <SortableHeader column="averageWin" sortConfig={sortConfig} handleSort={handleSort}>Avg Win</SortableHeader>
              <SortableHeader column="averageLoss" sortConfig={sortConfig} handleSort={handleSort}>Avg Loss</SortableHeader>
              <SortableHeader column="maxDrawdown" sortConfig={sortConfig} handleSort={handleSort}>Max DD</SortableHeader>
              <SortableHeader column="expectedValue" sortConfig={sortConfig} handleSort={handleSort}>EV</SortableHeader>
              <SortableHeader column="totalTrades" sortConfig={sortConfig} handleSort={handleSort}>Trades</SortableHeader>
              <SortableHeader column="margin" sortConfig={sortConfig} handleSort={handleSort}>Margin Rate</SortableHeader>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredMetrics.map((metrics: any, index: number) => (
              <tr key={metrics.originalFilename} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b">
                  <input
                    type="checkbox"
                    checked={selectedTradeLists.has(metrics.originalFilename)}
                    onChange={() => toggleSelection(metrics.originalFilename)}
                    className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 border-b">{metrics.portfolioHint}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 border-b">{metrics.strategyName || getDisplayName(metrics)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700 border-b">
                  <ContractInput
                    filename={metrics.originalFilename}
                    value={contractMultipliers[metrics.originalFilename] || 1.0}
                    onChange={handleContractChange}
                  />
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b font-medium">{metrics.symbol}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b">
                  <span className={`inline-flex px-1 sm:px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full ${metrics.direction === 'Long' ? 'bg-green-100 text-green-800' : metrics.direction === 'Short' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                    {metrics.direction}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b">
                  {metrics.intradayStatus ? (
                    <span className="inline-flex px-1 sm:px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{metrics.intradayStatus}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b border-gray-900 ${metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(metrics.netProfit)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b">{metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b">{metrics.winRate.toFixed(1)}%</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-green-600 border-b border-gray-900">{formatNumber(metrics.averageWin)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-600 border-b border-gray-900">{formatNumber(metrics.averageLoss)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-600 border-b border-gray-900">{formatNumber(metrics.maxDrawdown)}</td>
                <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b border-gray-900 ${metrics.expectedValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(metrics.expectedValue)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b">{metrics.totalTrades}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-blue-600 border-b border-gray-900 font-medium">{formatNumber(metrics.margin)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b text-center">
                  <button 
                    onClick={() => onDeleteStrategy(metrics.originalFilename)}
                    className={`transition-colors p-1 rounded hover:bg-gray-100 ${strategyIdMap[metrics.originalFilename] ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}`}
                    title={strategyIdMap[metrics.originalFilename] ? "Delete from Database" : "Remove from View"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MetricsTable;
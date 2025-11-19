# Supabase Database Migration Plan

**Project:** Futures Arena (formerly Portfolio Buddy 2)
**Created:** November 16, 2025
**Status:** Ready for Implementation
**Priority:** High (Enables automated trade data updates)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Migration Goals & Requirements](#migration-goals--requirements)
4. [Database Schema](#database-schema)
5. [Data Format Comparison](#data-format-comparison)
6. [Implementation Plan](#implementation-plan)
7. [Code Changes Required](#code-changes-required)
8. [SQL Query Examples](#sql-query-examples)
9. [Testing Strategy](#testing-strategy)
10. [Risk Assessment](#risk-assessment)
11. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### What We're Doing
Migrating the "Load Data" button from querying the old `csv_files` table to fetching data directly from the new `portfolios`, `strategies`, and `trades` tables.

### Why We're Doing It
- **Automation**: Python script on Windows VPS now uploads trades automatically
- **Real-time Data**: No manual CSV uploads required
- **Simplicity**: Single-row trade format is simpler than entry/exit pairs
- **Scalability**: Better database design for 100+ strategies

### What's NOT Changing
- ✅ CSV upload feature (preserved as backup/testing tool)
- ✅ All existing hooks (useMetrics, usePortfolio, etc.)
- ✅ All existing components (charts, tables, etc.)
- ✅ All metric calculations
- ✅ User interface and workflows

### Implementation Scope
- **Files Modified:** 2 (src/utils/dataUtils.ts, src/App.tsx)
- **New Code:** ~140 lines
- **Estimated Time:** 4-6 hours
- **Risk Level:** Low (isolated changes, backward compatible)

---

## Current State Analysis

### Existing CSV Upload Flow

**User Journey:**
1. User clicks "Upload CSV Files" button
2. Selects one or more CSV files from disk
3. App reads file content using FileReader API
4. `parseCSV()` splits content into header + data rows
5. `processCurrencyColumns()` converts "$1,234.56" → 1234.56
6. Data stored in `cleanedData` state object
7. `calculateMetrics()` processes trade pairs (2 rows per trade)
8. Charts and tables display results

**Current Data Format (CSV):**
```csv
Date/Time,           Entry/Exit, Profit/Loss, Cum Net Profit
2025-03-24 02:00:00, Entry,      0,           0
2025-03-24 02:00:00, Exit,       150,         150
2025-03-25 03:00:00, Entry,      0,           150
2025-03-25 03:00:00, Exit,       105,         255
```

**Key Characteristics:**
- 2 rows per trade (entry + exit)
- Cumulative equity pre-calculated in CSV
- Filename contains metadata: `{market}_{direction}_{portfolio_hint}_{strategy_name}.csv`

### New Database Structure

**Tables Created:**
1. **portfolios** - Portfolio definitions
2. **strategies** - Strategy metadata
3. **trades** - Individual trade records
4. **portfolio_strategies** - Links portfolios to strategies

**Current Database Contents:**
- 1 portfolio: "Master" (is_master=true)
- 1 strategy: "SI_Long_Test_TestStrategy1"
- 119 trades with individual profit values

**Python Script (Windows VPS):**
- Automatically uploads new trades to `trades` table
- Creates/updates strategy metadata in `strategies` table
- Links strategies to "Master" portfolio via `portfolio_strategies` table
- Runs on schedule (automated)

### Current Supabase Query (Outdated)

**File:** src/App.tsx, lines 216-319

```typescript
const fetchFromSupabase = async () => {
  const { data, error } = await supabase
    .from('csv_files')  // ❌ OLD TABLE (doesn't exist in new DB)
    .select('filename, file_content');

  // Creates File objects from CSV content
  // Passes to handleFileUpload()
}
```

**Problem:** Queries non-existent `csv_files` table instead of new schema.

---

## Migration Goals & Requirements

### Primary Goals
1. ✅ Load trade data from new database tables (`strategies`, `trades`)
2. ✅ Preserve all existing CSV upload functionality
3. ✅ Support both data sources simultaneously (CSV + Database)
4. ✅ Maintain backward compatibility with existing code
5. ✅ Use simpler single-row trade format from database

### Technical Requirements
- Fetch strategies linked to "Master" portfolio (is_master=true)
- Build synthetic filenames from strategy metadata
- Transform single-row trades to match expected data format
- Calculate cumulative equity in frontend (like CSV approach)
- Pre-populate contract multipliers from database
- Handle errors gracefully with user-friendly messages

### Non-Functional Requirements
- Performance: Load 119 trades in < 2 seconds
- Scalability: Support 100+ strategies with 1000s of trades
- Maintainability: Clean code following project standards
- Documentation: Inline comments explaining transformations

---

## Database Schema

> **Note:** For a detailed overview of the current database architecture, including row counts and critical configuration, see [dev-docs/database-architecture.md](database-architecture.md).

### portfolios Table
```sql
CREATE TABLE portfolios (
  id BIGINT PRIMARY KEY,
  portfolio_name TEXT NOT NULL,
  description TEXT,
  is_master BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**Current Data:**
| id | portfolio_name | is_master |
|----|----------------|-----------|
| 1  | Master         | true      |

### strategies Table
```sql
CREATE TABLE strategies (
  id BIGINT PRIMARY KEY,
  strategy_id TEXT NOT NULL UNIQUE,  -- "SI_Long_Test_TestStrategy1"
  market TEXT NOT NULL,               -- "SI", "ES", "NQ", etc.
  direction TEXT NOT NULL,            -- "Long" or "Short"
  strategy_name TEXT NOT NULL,        -- "TestStrategy1"
  display_name TEXT NOT NULL,         -- Full display name
  description TEXT,
  portfolio_hint TEXT,                -- "Test", "Live", etc.
  is_intraday BOOLEAN DEFAULT false,
  contract_multiplier NUMERIC DEFAULT 1.0,
  margin_required NUMERIC,
  is_benchmark BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  last_trade_at TIMESTAMP
);
```

**Current Data:**
| strategy_id | market | direction | strategy_name | portfolio_hint | contract_multiplier |
|-------------|--------|-----------|---------------|----------------|---------------------|
| SI_Long_Test_TestStrategy1 | SI | Long | TestStrategy1 | Test | 1.0 |

### trades Table
```sql
CREATE TABLE trades (
  id BIGINT PRIMARY KEY,
  strategy_id TEXT NOT NULL REFERENCES strategies(strategy_id),
  trade_date DATE NOT NULL,
  trade_time TIME NOT NULL,
  profit NUMERIC NOT NULL,           -- Individual trade P&L
  trade_type TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

**Sample Data:**
| id | strategy_id | trade_date | trade_time | profit |
|----|-------------|------------|------------|--------|
| 1  | SI_Long_Test_TestStrategy1 | 2025-03-17 | 08:00:00 | 0.0 |
| 2  | SI_Long_Test_TestStrategy1 | 2025-03-24 | 02:00:00 | 150.0 |
| 3  | SI_Long_Test_TestStrategy1 | 2025-03-25 | 03:00:00 | 105.0 |

### portfolio_strategies Table
```sql
CREATE TABLE portfolio_strategies (
  id BIGINT PRIMARY KEY,
  portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
  strategy_id TEXT NOT NULL REFERENCES strategies(strategy_id),
  contract_multiplier_override NUMERIC,  -- Optional override
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMP DEFAULT now(),
  notes TEXT
);
```

**Current Data:**
| id | portfolio_id | strategy_id | is_active |
|----|--------------|-------------|-----------|
| 1  | 1            | SI_Long_Test_TestStrategy1 | true |

---

## Data Format Comparison

### CSV Format (Current - 2 rows per trade)
```typescript
cleanedData = {
  "SI_Long_Test_TestStrategy1.csv": {
    header: ["Date/Time", "Entry/Exit", "Profit/Loss", "Cum Net Profit"],
    data: [
      ["2025-03-24 02:00:00", "Entry", "0", "0"],
      ["2025-03-24 02:00:00", "Exit", "150", "150"],
      ["2025-03-25 03:00:00", "Entry", "0", "150"],
      ["2025-03-25 03:00:00", "Exit", "105", "255"],
      // ... (2 rows per trade)
    ],
    rowCount: 238,  // 119 trades × 2 rows
    columnCount: 4
  }
}
```

**Processed by:** `calculateMetrics()` (lines 197-305 in dataUtils.ts)
**Logic:** Loops through data in pairs (`i += 2`), extracts cumEquity from exit row

### Database Format (New - 1 row per trade)
```typescript
// Database provides:
{
  strategy_id: "SI_Long_Test_TestStrategy1",
  market: "SI",
  direction: "Long",
  strategy_name: "TestStrategy1",
  portfolio_hint: "Test",
  contract_multiplier: 1.0,
  trades: [
    { trade_date: "2025-03-24", trade_time: "02:00:00", profit: 150.0 },
    { trade_date: "2025-03-25", trade_time: "03:00:00", profit: 105.0 },
    // ... (1 row per trade)
  ]
}

// We transform to:
cleanedData = {
  "SI_Long_Test_TestStrategy1.csv": {
    header: ["Date/Time", "Profit/Loss", "Cum Net Profit"],
    data: [
      ["2025-03-24 02:00:00", "150", "150"],
      ["2025-03-25 03:00:00", "105", "255"],
      // ... (1 row per trade, cumulative calculated)
    ],
    rowCount: 119,
    columnCount: 3
  }
}
```

**Processed by:** `calculateMetricsFromDatabase()` (NEW function)
**Logic:** Loops through trades sequentially (`i++`), calculates cumulative equity on the fly

### Key Differences

| Aspect | CSV Format | Database Format |
|--------|------------|-----------------|
| Rows per trade | 2 (entry + exit) | 1 (complete round-trip) |
| Cumulative equity | Pre-calculated in CSV | Calculated in frontend |
| Metadata source | Filename parsing | Database columns |
| Entry rows | Exist with $0 profit | Not needed (implicit) |
| Data source | File upload | Database query |
| Update frequency | Manual | Automated (Python script) |

---

## Implementation Plan

### Phase 1: Create Database Metrics Function
**Goal:** Add new function to process single-row trade format

**File:** src/utils/dataUtils.ts
**New Function:** `calculateMetricsFromDatabase()`
**Lines Added:** ~80 lines
**Time Estimate:** 1-2 hours

**Function Signature:**
```typescript
export const calculateMetricsFromDatabase = (
  trades: DatabaseTrade[],
  strategyMetadata: StrategyMetadata
): Metrics | null => {
  // ... implementation
}
```

**Key Differences from `calculateMetrics()`:**
- ✅ Accepts array of trade objects instead of CSV data
- ✅ Loops sequentially (not in pairs)
- ✅ Calculates cumulative equity from individual profits
- ✅ Uses strategy metadata directly (not filename parsing)
- ✅ Returns same Metrics object format

### Phase 2: Update Supabase Query
**Goal:** Fetch from new tables and transform data

**File:** src/App.tsx
**Function Modified:** `fetchFromSupabase()` (lines 216-319)
**Lines Changed:** ~60 lines
**Time Estimate:** 2-3 hours

**New Query Structure:**
```typescript
const fetchFromSupabase = async () => {
  // 1. Fetch strategies from Master portfolio
  const { data: strategies, error } = await supabase
    .from('strategies')
    .select(`
      *,
      trades (
        trade_date,
        trade_time,
        profit
      )
    `)
    .eq('strategies.strategy_id', 'portfolio_strategies.strategy_id')
    .eq('portfolio_strategies.portfolio_id', 1)  // Master portfolio
    .order('trades.trade_date', { ascending: true });

  // 2. Transform to cleanedData format
  const newCleanedData = {};
  for (const strategy of strategies) {
    const filename = buildFilename(strategy);
    const metrics = calculateMetricsFromDatabase(strategy.trades, strategy);

    // Build cleanedData structure
    newCleanedData[filename] = {
      header: ["Date/Time", "Profit/Loss", "Cum Net Profit"],
      data: buildDataRows(strategy.trades),
      rowCount: strategy.trades.length,
      columnCount: 3
    };
  }

  // 3. Update state
  setCleanedData(newCleanedData);
}
```

### Phase 3: Testing & Validation
**Goal:** Verify everything works correctly

**Time Estimate:** 1-2 hours

**Test Cases:**
1. Load data from database (119 trades)
2. Verify metrics match expected values
3. Test equity curve displays correctly
4. Upload CSV manually (test backward compatibility)
5. Mix database + CSV data sources
6. Test contract multipliers pre-populate correctly
7. Test error handling (database unavailable, etc.)

---

## Code Changes Required

### File 1: src/utils/dataUtils.ts

**Add New Interface (after line 40):**
```typescript
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
  display_name: string;
  portfolio_hint?: string | null;
  is_intraday: boolean;
  contract_multiplier: number;
  margin_required?: number | null;
  is_benchmark: boolean;
}
```

**Add New Function (after line 305):**
```typescript
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

/**
 * Build filename from strategy metadata
 * Format: {market}_{direction}_{portfolio_hint}_{strategy_name}.csv
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
```

### File 2: src/App.tsx

**Update fetchFromSupabase function (replace lines 216-319):**
```typescript
const fetchFromSupabase = async () => {
  setProcessing(true);
  setErrors([]);

  try {
    // Fetch strategies from Master portfolio with their trades
    const { data: strategies, error } = await supabase
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
        is_benchmark,
        trades (
          trade_date,
          trade_time,
          profit,
          trade_type,
          notes
        )
      `)
      .order('trades.trade_date', { foreignTable: 'trades', ascending: true })
      .order('trades.trade_time', { foreignTable: 'trades', ascending: true });

    if (error) {
      const errorDetails = [
        error.message,
        error.details ? `Details: ${error.details}` : null,
        error.hint ? `Hint: ${error.hint}` : null
      ].filter(Boolean).join('. ');
      throw new Error(errorDetails || 'Supabase query failed');
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('No strategies found in database');
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
          cumEquity += trade.profit;
          const datetime = `${trade.trade_date} ${trade.trade_time}`;

          dataRows.push([
            datetime,
            trade.profit.toString(),
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
```

**Import new functions at top of file (after line 17):**
```typescript
import {
  parseCSV,
  processCurrencyColumns,
  buildCorrelationMatrix,
  calculateMetricsFromDatabase,
  buildFilenameFromMetadata
} from './utils/dataUtils.ts';
```

---

## SQL Query Examples

### Fetch All Strategies with Trades
```sql
SELECT
  s.strategy_id,
  s.market,
  s.direction,
  s.strategy_name,
  s.display_name,
  s.portfolio_hint,
  s.contract_multiplier,
  s.is_intraday,
  s.is_benchmark,
  t.trade_date,
  t.trade_time,
  t.profit
FROM strategies s
LEFT JOIN trades t ON s.strategy_id = t.strategy_id
ORDER BY s.strategy_id, t.trade_date ASC, t.trade_time ASC;
```

### Fetch Strategies in Master Portfolio Only
```sql
SELECT
  s.*,
  ps.contract_multiplier_override
FROM portfolio_strategies ps
INNER JOIN strategies s ON ps.strategy_id = s.strategy_id
INNER JOIN portfolios p ON ps.portfolio_id = p.id
WHERE p.is_master = true
  AND ps.is_active = true;
```

### Count Trades per Strategy
```sql
SELECT
  s.strategy_id,
  s.display_name,
  COUNT(t.id) as trade_count,
  SUM(t.profit) as total_profit
FROM strategies s
LEFT JOIN trades t ON s.strategy_id = t.strategy_id
GROUP BY s.strategy_id, s.display_name
ORDER BY trade_count DESC;
```

### Fetch Trades in Date Range
```sql
SELECT *
FROM trades
WHERE strategy_id = 'SI_Long_Test_TestStrategy1'
  AND trade_date >= '2025-03-01'
  AND trade_date <= '2025-05-31'
ORDER BY trade_date ASC, trade_time ASC;
```

---

## Testing Strategy

### Unit Testing Checklist

**Test calculateMetricsFromDatabase():**
- [ ] Returns null for empty trade array
- [ ] Calculates cumulative equity correctly
- [ ] Calculates profit factor accurately
- [ ] Handles negative trades (losses)
- [ ] Calculates max drawdown correctly
- [ ] Matches calculateMetrics() output format
- [ ] Uses strategy metadata correctly
- [ ] Builds filename correctly

**Test buildFilenameFromMetadata():**
- [ ] Builds filename from all parts
- [ ] Handles missing portfolio_hint gracefully
- [ ] Formats as: market_direction_hint_name
- [ ] Removes null/undefined values

### Integration Testing Scenarios

**Test fetchFromSupabase():**
- [ ] Successfully queries database
- [ ] Handles empty database (no strategies)
- [ ] Handles strategies without trades
- [ ] Transforms data to cleanedData format
- [ ] Pre-populates contract multipliers
- [ ] Auto-selects loaded strategies
- [ ] Shows user-friendly error messages
- [ ] Handles network errors gracefully

**Test Dual Data Sources:**
- [ ] Load data from database
- [ ] Upload CSV manually (same strategy)
- [ ] Both appear in metrics table
- [ ] Both work in portfolio analysis
- [ ] Contract multipliers work for both
- [ ] Sorting/filtering works for both

### Validation Criteria

**Data Accuracy:**
- [ ] 119 trades loaded from database
- [ ] Total profit matches expected value
- [ ] Cumulative equity ends at correct value
- [ ] Win rate matches manual calculation
- [ ] Max drawdown matches manual calculation

**UI/UX:**
- [ ] "Load Data" button shows loading state
- [ ] Success message appears on completion
- [ ] Error messages are clear and actionable
- [ ] Loaded strategies appear in table immediately
- [ ] Equity curve renders correctly
- [ ] Contract multiplier inputs show database values

**Performance:**
- [ ] Load time < 2 seconds for 119 trades
- [ ] Load time < 5 seconds for 1000 trades
- [ ] No UI freezing during load
- [ ] Smooth chart rendering

---

## Risk Assessment

### What Could Go Wrong

**Risk 1: Database Query Fails**
- **Probability:** Medium
- **Impact:** High
- **Symptoms:** "Database fetch error" message, no data loads
- **Mitigation:**
  - Comprehensive error handling with user-friendly messages
  - Fallback to CSV upload (always available)
  - Network error detection with retry suggestion
- **Rollback:** Revert fetchFromSupabase() changes, use CSV only

**Risk 2: Data Transformation Errors**
- **Probability:** Low-Medium
- **Impact:** High
- **Symptoms:** Incorrect metrics, NaN values, chart rendering fails
- **Mitigation:**
  - Thorough testing with known data (119 trades)
  - Type safety with TypeScript interfaces
  - Null/undefined checks throughout
  - Validate cumulative equity calculation manually
- **Rollback:** Disable database fetch, use CSV only

**Risk 3: Cumulative Equity Calculation Mismatch**
- **Probability:** Low
- **Impact:** Medium
- **Symptoms:** Different results vs CSV upload
- **Mitigation:**
  - Unit test calculateMetricsFromDatabase() output
  - Compare side-by-side with CSV results
  - Validate with simple test case (3-5 trades)
- **Rollback:** Fix calculation logic, redeploy

**Risk 4: Contract Multiplier Pre-population Conflicts**
- **Probability:** Low
- **Impact:** Low
- **Symptoms:** User-inputted values overwritten by database values
- **Mitigation:**
  - Only pre-populate if value not already set
  - Clear UI indication of database vs user values
  - Allow user override always
- **Rollback:** Remove pre-population, let user input manually

**Risk 5: Performance Degradation with Large Datasets**
- **Probability:** Medium (future)
- **Impact:** Medium
- **Symptoms:** Slow load times (> 5 seconds), UI freezing
- **Mitigation:**
  - Test with 1000+ trades before production
  - Implement pagination if needed
  - Add loading indicators
  - Consider worker threads for calculations
- **Rollback:** Add trade count limit, optimize query

### Prevention Strategies

1. **Test with Production Data First:**
   - Use actual 119 trades from database
   - Verify calculations match expectations
   - Compare with CSV upload of same data

2. **Incremental Rollout:**
   - Test locally first (localhost)
   - Deploy to staging environment
   - Get user feedback before full production

3. **Feature Flag (Optional):**
   - Add environment variable to enable/disable database fetch
   - Easy rollback without code changes
   - Can disable remotely if issues arise

4. **Monitoring:**
   - Log database query times
   - Track error rates
   - Monitor user feedback

### Rollback Procedures

**Immediate Rollback (< 5 minutes):**
```bash
# Revert last commit
git revert HEAD
git push origin main

# Or disable feature via environment variable
VITE_ENABLE_DATABASE_FETCH=false
```

**Partial Rollback (Keep new code, disable feature):**
```typescript
// In fetchFromSupabase(), add early return:
const fetchFromSupabase = async () => {
  if (true) {  // Disable database fetch
    alert('Database fetch temporarily disabled. Please use CSV upload.');
    return;
  }
  // ... rest of code
}
```

**Full Rollback (Restore old version):**
```bash
git checkout <commit-before-migration>
git checkout -b hotfix/restore-old-version
git push origin hotfix/restore-old-version
# Create PR to merge hotfix to main
```

---

## Future Enhancements

### Phase 2 Features (After Initial Migration)

**1. Portfolio Selector Dropdown**
- Allow users to choose which portfolio to load
- Default to "Master" portfolio
- Show strategy count per portfolio
- Save preference in localStorage

**2. Auto-Refresh Functionality**
- Refresh data every X minutes (configurable)
- Show "last updated" timestamp
- Manual refresh button
- Notification on new trades detected

**3. Performance Optimizations**
- Implement pagination (load 50 strategies at a time)
- Virtual scrolling for large strategy lists
- Memoize expensive calculations
- Optimize database queries with indexes

**4. Enhanced Error Handling**
- Retry failed queries automatically
- Offline mode detection
- Partial data loading (some strategies succeed, some fail)
- Detailed error logs for debugging

### Phase 3 Features (Long-term)

**5. Real-time Updates**
- WebSocket connection to Supabase
- Live trade updates as Python script uploads
- Toast notifications for new trades
- Animated equity curve updates

**6. Historical Snapshots**
- Save portfolio state at specific dates
- Compare current vs historical performance
- Track strategy evolution over time
- Archive old strategies

**7. Advanced Filtering**
- Filter strategies by market (ES, NQ, etc.)
- Filter by direction (Long, Short)
- Filter by performance metrics
- Save filter presets

**8. Bulk Operations**
- Bulk edit contract multipliers
- Bulk enable/disable strategies
- Bulk export to CSV/Excel
- Batch delete operations

---

## Conclusion

This migration plan provides a clear, step-by-step approach to integrate Supabase database fetching while preserving all existing CSV upload functionality. The implementation is low-risk, backward-compatible, and sets the foundation for future automation features.

**Next Steps:**
1. Review this plan with team
2. Implement Phase 1 (calculateMetricsFromDatabase)
3. Implement Phase 2 (update fetchFromSupabase)
4. Test thoroughly with 119 existing trades
5. Deploy to staging
6. Get user feedback
7. Deploy to production
8. Monitor for issues
9. Plan Phase 2 enhancements

**Success Criteria:**
- ✅ "Load Data" button fetches from database successfully
- ✅ 119 trades display correctly
- ✅ Metrics match expected values
- ✅ CSV upload still works
- ✅ No regressions in existing features
- ✅ User-friendly error messages
- ✅ Load time < 2 seconds

---

**Document Status:** Ready for Implementation
**Last Updated:** November 16, 2025
**Next Review:** After Phase 1 completion

# Portfolio Buddy 2 - Project Overview

**Last Updated:** October 30, 2025
**Original Developer:** Santiago (via Lovable)
**Current Developer:** Taking over development
**Repository:** https://github.com/5HinFutures/portfolio-buddy-2
**Status:** Production-ready, actively maintained

## Project Purpose

Portfolio Buddy 2 is a sophisticated trading analytics application designed for futures traders in the 5minfutures community. It enables traders to:

- Upload and analyze CSV trade data from multiple trading strategies
- Calculate comprehensive performance metrics (15+ metrics per strategy)
- Build combined portfolios from multiple strategies
- Visualize equity curves and drawdowns with interactive charts
- Analyze correlations between strategies using Spearman correlation
- Optimize portfolio composition through data-driven insights
- Export cleaned data and analysis results

## Built With Lovable

This project was created using Lovable, an AI-powered development platform.

- **Lovable Project ID:** 68cf6fef-03c3-4f10-96e2-64490bd6308e
- **Integration:** Changes via Lovable auto-commit to GitHub
- **Flexibility:** Can develop locally and push changes OR use Lovable platform
- **Component Tagging:** lovable-tagger plugin tags components in dev mode

## Tech Stack

### Core Framework
- **React:** 19.1.1 (latest version with modern features)
- **TypeScript:** 5.9.3 with strict mode enabled
- **Build Tool:** Vite 7.1.7 (ultra-fast HMR and builds)

### Styling
- **Tailwind CSS:** 4.1.14 (latest v4 with native CSS variables)
- **Design System:** shadcn-ui color tokens configured (no pre-built components used)
- **Icons:** lucide-react 0.545.0

### Data Visualization
- **Chart.js:** 4.5.1 (primary charting library)
- **react-chartjs-2:** 5.3.0 (React wrapper)
- **Plugins:**
  - chartjs-adapter-date-fns: Time-series support
  - chartjs-plugin-zoom: Interactive zoom/pan
  - chartjs-plugin-annotation: Max drawdown markers

### Backend & Data
- **Supabase:** 2.75.0 (PostgreSQL cloud database)
- **Date Handling:** date-fns 4.1.0

### Development Tools
- **ESLint:** 9.36.0 with React hooks rules
- **TypeScript ESLint:** 8.45.0
- **Vite Plugin React:** 5.0.4

## Project Structure

```
Portfolio Buddy 2/
├── src/
│   ├── components/          # 17 React UI components
│   │   ├── AnalyticsControls.tsx
│   │   ├── ContractInput.tsx
│   │   ├── CorrelationHeatmap.tsx
│   │   ├── CorrelationSection.tsx
│   │   ├── CustomTooltip.tsx
│   │   ├── ErrorList.tsx
│   │   ├── Header.tsx
│   │   ├── MasterContractControl.tsx
│   │   ├── MetricsTable.tsx
│   │   ├── PortfolioSection.tsx      # 511 lines - complex charting
│   │   ├── SessionComplete.tsx
│   │   ├── SortableHeader.tsx
│   │   ├── UploadedFilesList.tsx
│   │   └── UploadSection.tsx
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useContractMultipliers.ts  # Contract size adjustments
│   │   ├── useMetrics.ts              # Metric calculations & sorting
│   │   ├── usePortfolio.ts            # Portfolio analysis
│   │   └── useSorting.ts              # Multi-column sorting
│   │
│   ├── utils/                # Pure utility functions
│   │   ├── constants.ts      # Margin rates for 64 futures contracts
│   │   └── dataUtils.ts      # CSV parsing, metrics, correlations (520 lines)
│   │
│   ├── assets/               # Static assets
│   │   ├── skool-logo.png
│   │   └── react.svg
│   │
│   ├── App.tsx               # Main component (295 lines)
│   ├── App.css               # Component styles
│   ├── index.css             # Global styles (Tailwind imports)
│   ├── main.tsx              # Entry point
│   └── supabaseClient.ts     # Database client
│
├── dev-docs/                 # Development documentation (this folder)
├── .claude/                  # Claude AI workflow integration
├── public/                   # Static public assets
├── index.html                # HTML entry point
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript base config
├── tsconfig.app.json         # TypeScript app config
├── tailwind.config.ts        # Tailwind configuration
├── eslint.config.js          # ESLint rules
├── package.json              # Dependencies & scripts
└── README.md                 # Standard Vite template README
```

### Architecture Organization

**Components** - Organized by feature:
- **File Management:** UploadSection, UploadedFilesList, ErrorList
- **Data Display:** MetricsTable, SortableHeader, CustomTooltip
- **Analytics:** PortfolioSection, CorrelationSection, CorrelationHeatmap
- **Controls:** AnalyticsControls, ContractInput, MasterContractControl
- **Layout:** Header, SessionComplete

**Hooks** - Business logic separation:
- `useMetrics`: Computes trading metrics, handles sorting/filtering
- `usePortfolio`: Builds combined portfolios, equity curves, drawdowns
- `useSorting`: Multi-priority column sorting state
- `useContractMultipliers`: Contract size adjustment logic

**Utils** - Pure functions:
- `constants.ts`: Static data (margin rates, sortable columns)
- `dataUtils.ts`: CSV parsing, metric calculations, correlation algorithms

## Key Features

### 1. CSV Trade Data Management
- Upload multiple CSV files (local file selection)
- Fetch CSV files from Supabase database
- Export cleaned CSV data
- Remove uploaded files
- Duplicate detection with overwrite prompts

**Location:** [src/components/UploadSection.tsx](src/components/UploadSection.tsx)

### 2. Trading Metrics Calculation
Computes 15+ metrics per strategy:
- Net Profit, Gross Profit/Loss
- Profit Factor
- Win Rate, Average Win/Loss
- Expected Value
- Max Drawdown
- Total Trades, Winning/Losing counts
- Largest Win/Loss
- Margin Requirements
- Date Range (Start/End dates)

**Location:** [src/utils/dataUtils.ts:197-305](src/utils/dataUtils.ts#L197-L305)

### 3. Advanced Multi-Column Sorting
- Single-click sorting (ascending/descending)
- Multi-priority sorting (sort by multiple columns)
- Visual sort indicators
- 14 sortable columns

**Location:** [src/hooks/useSorting.ts](src/hooks/useSorting.ts)

### 4. Contract Size Adjustment
- Individual multipliers per strategy (0.1x to 10x)
- Master control applies to all strategies
- Metrics automatically recalculated
- Preset values for quick adjustments

**Location:** [src/hooks/useContractMultipliers.ts](src/hooks/useContractMultipliers.ts)

### 5. Portfolio Analysis
Build combined portfolios from selected strategies:
- **Equity Curve:** Combined P&L over time
- **Drawdown Chart:** Portfolio drawdown visualization
- **Individual Performance:** Overlay of all strategies
- **Normalization:** Option to normalize by margin
- **Date Range Filtering:** Custom start/end dates
- **Starting Capital:** Configurable initial capital

**Portfolio Metrics:**
- Total Return, Annual Growth Rate
- PNL/Drawdown Ratio
- Max Drawdown ($ and %)
- Win Rate, Average Win/Loss
- Expected Value
- Total Margin Required
- Trading Days
- Sharpe/Sortino Ratios

**Location:** [src/components/PortfolioSection.tsx](src/components/PortfolioSection.tsx)

### 6. Correlation Analysis
- **Spearman Correlation:** Rank-based correlation between strategies
- **Heatmap Visualization:** Color-coded correlation matrix
- **Threshold Setting:** Adjustable correlation threshold
- **Export:** Download correlation data as CSV
- **Statistics:** High positive/negative correlation counts

**Location:** [src/components/CorrelationSection.tsx](src/components/CorrelationSection.tsx)

### 7. Interactive Charting
Built with Chart.js:
- Zoom (mouse wheel)
- Pan (drag)
- Time-series axis
- Tooltips on hover
- Max drawdown annotations
- Responsive design

### 8. Strategy Naming Intelligence
Parses filenames to extract metadata:
- **Symbol:** ES, NQ, RTY, etc.
- **Direction:** Long/Short
- **Intraday Status:** DTH (Day Trading Hours)
- **Strategy Name:** Custom identifier
- **Benchmark Detection:** Special handling

**Example:** `ES_LONG_DTH_MyStrategy.csv` parses to:
- Symbol: ES
- Direction: Long
- DTH: Yes
- Strategy: MyStrategy

**Location:** [src/utils/dataUtils.ts:138-190](src/utils/dataUtils.ts#L138-L190)

## Code Quality Assessment

### Overall Grade: B+ (Very Good)

### Strengths
- **Modern React Patterns:** Functional components, hooks-based architecture
- **Type Safety:** Comprehensive TypeScript with strict mode enabled
- **Performance:** Extensive use of useMemo/useCallback for optimization
- **Separation of Concerns:** Clear division between UI, logic, and utilities
- **Clean Code:** Consistent naming, logical organization

### Areas for Improvement

#### High Priority
1. **Component Size:** Several components exceed 300 lines
   - PortfolioSection.tsx: 511 lines
   - App.tsx: 295 lines
   - MetricsTable.tsx: 231 lines

2. **Error Handling:**
   - No error boundaries
   - Limited error recovery mechanisms
   - Debug console.log statements in production code

3. **Testing:**
   - No test files found
   - No test configuration
   - No CI/CD pipeline

#### Medium Priority
4. **Prop Drilling:** Up to 30+ props passed to PortfolioSection
   - Consider Context API for shared state
   - Component composition patterns

5. **State Management:** 15+ state variables in App.tsx
   - Could benefit from useReducer or global state

6. **Documentation:**
   - No JSDoc comments
   - No architecture documentation (until now!)

#### Low Priority
7. **Magic Numbers:** Hardcoded values without explanation
8. **Any Types:** Some uses of `any` type that could be more specific
9. **Unused Dependencies:** recharts package not used

### TypeScript Usage: Excellent
- Comprehensive interface definitions
- Proper typing for all component props
- Type-safe hook implementations
- Good use of generics

### Component Structure: Very Good
- Functional components throughout
- Props interfaces for every component
- Business logic in hooks
- Memoization for performance

## Development Workflow

### Before Starting Any Feature
1. Review relevant dev-docs
2. Check master skills at `C:\Users\kg129\Desktop\5MF\claude-skills\`
3. Review existing code patterns
4. Plan with ICE scoring if complex

### During Development
1. Follow coding-standards.md for all code
2. Follow react-standards.md for React components
3. Write TypeScript types first
4. Use existing hooks/utils patterns
5. Keep components under 200 lines
6. Add error handling
7. Test manually (no automated tests yet)

### After Development
1. Self-review against skills
2. Document decisions in this file
3. Commit with conventional commit message
4. Update dev-docs if architecture changed

### Git Workflow
```bash
# Feature branch workflow
git checkout -b feature/your-feature-name
# Make changes
git add .
git commit -m "feat: add feature description"
git push -u origin feature/your-feature-name
# Create PR on GitHub
```

## Decisions Log

### October 30, 2025 - Initial Takeover & Analysis

**Context:** Taking over Portfolio Buddy 2 from Santiago. Conducted comprehensive codebase analysis to understand architecture, patterns, and code quality before beginning new development work.

**Findings:**

**Architecture:**
- Well-structured React 19 + TypeScript application
- Custom hooks pattern for business logic separation
- Local state management (no Redux/Context yet)
- Supabase integration for CSV file storage
- Chart.js for data visualization
- 64 futures contracts supported with margin rates

**Code Quality:**
- Grade: B+ (Very Good)
- Strong TypeScript usage with strict mode
- Good separation of concerns
- Performance-optimized with memoization
- Needs: testing, error boundaries, smaller components

**Features:**
- CSV trade data upload/management
- Trading metrics calculation (15+ metrics)
- Multi-column sorting with priorities
- Contract size adjustments
- Portfolio analysis with equity curves
- Correlation analysis with heatmap
- Interactive charting with zoom/pan

**Technical Debt:**
- Large components (PortfolioSection: 511 lines)
- Prop drilling (30+ props to some components)
- No tests or error boundaries
- Debug console.logs present
- Some hardcoded values

**Next Steps:**
1. Create complete dev-docs (this file + 5 others)
2. Analyze old Portfolio_Buddy app (2800 LOC monolithic)
3. Create migration strategy with ICE scoring
4. Begin feature-by-feature migration
5. Add testing infrastructure
6. Refactor large components

**Recommendations:**
- Add error boundaries immediately
- Break PortfolioSection into sub-components
- Implement testing (Vitest + React Testing Library)
- Remove console.log statements
- Consider Context API for widely-used state
- Add JSDoc comments to utilities

**References:**
- Analysis stored in this file
- Tech stack details in dev-docs/tech-stack.md
- Master skills: `C:\Users\kg129\Desktop\5MF\claude-skills\`

---

## Quick Reference

### Run Development Server
```bash
npm run dev
# Opens at http://localhost:8080
```

### Build for Production
```bash
npm run build
npm run preview  # Test production build
```

### Lint Code
```bash
npm run lint
```

### Environment Variables Required
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Key Files to Know
- [src/App.tsx](src/App.tsx) - Main application logic
- [src/utils/dataUtils.ts](src/utils/dataUtils.ts) - Core calculations
- [src/utils/constants.ts](src/utils/constants.ts) - Margin rates & config
- [src/components/PortfolioSection.tsx](src/components/PortfolioSection.tsx) - Portfolio analytics
- [src/components/CorrelationSection.tsx](src/components/CorrelationSection.tsx) - Correlation analysis

### Master Skills Location
```
C:\Users\kg129\Desktop\5MF\claude-skills\
├── general\
│   └── coding-standards.md
└── frontend\
    └── react-standards.md
```

### Old App to Migrate From
```
C:\Users\kg129\Desktop\5MF\Portfolio_Buddy\src\App.tsx
(2800 lines - to be analyzed and migrated)
```

---

## Community & Branding

**5minfutures Trading Community**
- Skool community branding present
- Embedded GoHighLevel lead capture form
- Focus on futures trading education
- Website: https://www.5minfutures.com/

---

## Supabase Database Migration ✅ COMPLETED

### Status: Production Ready - Deployed (Nov 16, 2025)

**PR #1 Merged:** d56497a
**Commits:** c4fa57c, a5ce0ec, 676de06, eba4c8d, ee7cec8, ae9202d

**Goal:** Migrate from CSV file uploads to automated database fetching

**Background:**
- Old approach: Manual CSV uploads to `csv_files` table
- New approach: Python script on Windows VPS uploads trades automatically
- New database schema: `portfolios`, `strategies`, `trades`, `portfolio_strategies`

**Final State:**
- ✅ Python automation script running on Windows VPS
- ✅ New database schema created and populated
- ✅ 1 strategy with 119 trades uploaded automatically
- ✅ Frontend fetches from new `strategies` + `trades` tables
- ✅ Format auto-detection (1-row vs 2-row) implemented
- ✅ All 119 trades loading correctly
- ✅ Metrics calculated accurately
- ✅ CSV upload backward compatibility verified
- ✅ User tested and approved
- ✅ Deployed to production

**Migration Plan:**
See detailed plan: [dev-docs/supabase-migration-plan.md](supabase-migration-plan.md)

**Implemented Changes:**
1. ✅ Added `calculateMetricsFromDatabase()` function (src/utils/dataUtils.ts:546-650)
2. ✅ Added `buildFilenameFromMetadata()` helper (src/utils/dataUtils.ts:527-536)
3. ✅ Updated `fetchFromSupabase()` query (src/App.tsx:216-361)
4. ✅ Fixed Supabase query syntax for ordering nested trades
5. ✅ Fixed embedded resource limit (separate queries for trades)
6. ✅ Added TypeScript interfaces (DatabaseTrade, StrategyFromDB)
7. ✅ Modified `calculateMetrics()` with format auto-detection (src/utils/dataUtils.ts:218-296)
8. ✅ Pre-populate contract multipliers from database

**Implementation Journey (6 commits):**
- c4fa57c: Initial implementation (database fetch + functions)
- a5ce0ec: Fix query syntax error
- 676de06: Fix trade count limit (59→119 trades)
- eba4c8d: Fix TypeScript build errors
- ee7cec8: Auto-detect format (1-row vs 2-row) ⭐ **CRITICAL FIX**
- ae9202d: Update documentation

**Actual Time:** ~6 hours (debugging + testing included)

**Benefits Realized:**
- ✅ Real-time trade data (no manual uploads)
- ✅ Automated updates via Python script
- ✅ Dual format support (database + CSV)
- ✅ Scalable to 100+ strategies
- ✅ CSV upload preserved for testing/backup
- ✅ Format auto-detection seamless

**Challenges Solved:**
- Supabase embedded resource limit (~60 rows) → Separated queries
- Query syntax errors → Fixed foreignTable ordering
- TypeScript build errors → Added proper interfaces
- Metrics calculation wrong → Format auto-detection logic

**Final Results:**
- ✅ 119 trades loaded from database
- ✅ All metrics accurate (win rate, profit factor, max drawdown, etc.)
- ✅ CSV upload still works (backward compatible)
- ✅ Zero breaking changes to existing functionality

---

**Document maintained by:** Current development team
**Last comprehensive review:** November 16, 2025 (Post-migration)
**Next review due:** January 2026 (Post-production monitoring)
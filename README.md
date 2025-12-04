# Futures Arena

**Formerly:** Portfolio Buddy 2

A sophisticated trading analytics application for futures traders. Analyze trading strategies, build portfolios, and optimize performance with comprehensive metrics and visualizations.

## Features

- 📊 **Trade Data Analysis** - Upload CSV files or load from Supabase database
- 📈 **Portfolio Analytics** - Build combined portfolios from multiple strategies
- 🎯 **15+ Trading Metrics** - Profit factor, Sharpe ratio, max drawdown, and more
- 📉 **Interactive Charts** - Equity curves, drawdowns, and correlation heatmaps
- 🔄 **Automated Updates** - Python script uploads trades automatically to database
- 💾 **Dual Data Sources** - CSV upload (manual) + Database fetch (automated)
- 🗑️ **Delete Strategies** - Remove strategies from database or view
- 📱 **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **React 19** + **TypeScript** + **Vite** (ultra-fast development)
- **Tailwind CSS 4** (modern styling)
- **Chart.js** (interactive charts with zoom/pan)
- **Supabase** (PostgreSQL cloud database)
- **date-fns** (date handling)

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase account (for database features)

### Installation

```bash
# Clone the repository
git clone https://github.com/5HinFutures/futures-arena.git
cd futures-arena

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add your Supabase credentials to .env
# VITE_SUPABASE_URL=your_project_url
# VITE_SUPABASE_ANON_KEY=your_anon_key

# Start development server
npm run dev
```

Visit http://localhost:8080

### Build for Production

```bash
npm run build
npm run preview  # Test production build locally
```

## Database Integration

### How It Works

**Two Ways to Load Trade Data:**

1. **CSV Upload** (Manual) - Upload CSV files from your computer
2. **Database Fetch** (Automated) - Load trades automatically uploaded by Python script

### Database Setup

**Required Supabase Tables:**
- `portfolios` - Portfolio definitions
- `strategies` - Strategy metadata (market, direction, contract multiplier)
- `trades` - Individual trade records (date, time, profit)
- `portfolio_strategies` - Links portfolios to strategies

**Python Automation:**
- Python script on Windows VPS uploads trades automatically
- Creates/updates strategies in database
- Links strategies to "Master" portfolio
- Frontend fetches data via "Load Data from Supabase" button

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Get these values from your Supabase project settings.

### Current Status (Dec 2, 2025)

- ✅ Python script uploading trades automatically
- ✅ Database schema created and populated
- ✅ 1 strategy with 119 trades in database
- ✅ Frontend database integration COMPLETE (PR #1 merged: d56497a)
- ✅ Format auto-detection (1-row vs 2-row) implemented
- ✅ All 119 trades loading correctly
- ✅ Dual CSV/Database mode working in production
- ✅ Delete functionality (c372ab7) - Remove strategies from database or view

**See migration details:** `dev-docs/supabase-migration-plan.md`

### Future Features

After completing database integration:
- Portfolio selector dropdown
- Auto-refresh every X minutes
- Real-time trade updates via WebSocket
- Historical snapshot comparisons

## CSV File Format

Upload CSVs with trade data in TradeStation format:

```csv
Date/Time, Entry/Exit, Shares/Ctrts, Profit/Loss, Cum Net Profit
2025-03-24 02:00:00, Entry, 1, 0, 0
2025-03-24 02:00:00, Exit, 1, 150, 150
...
```

**Filename Format:** `{market}_{direction}_{portfolio_hint}_{strategy_name}.csv`

Example: `ES_Long_DTH_MyStrategy.csv`
- Market: ES (E-mini S&P 500)
- Direction: Long
- DTH: Day Trading Hours
- Strategy: MyStrategy

## Development

### Project Structure

```
futures-arena/
├── src/
│   ├── components/       # React UI components
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   │   ├── dataUtils.ts  # CSV parsing, metrics calculations
│   │   └── constants.ts  # Margin rates for futures contracts
│   ├── App.tsx           # Main application
│   └── supabaseClient.ts # Database client
├── dev-docs/             # Development documentation
│   ├── supabase-migration-plan.md  # Database migration details
│   ├── project-overview.md         # Architecture overview
│   └── migration-strategy.md       # Feature migration tracking
└── .claude/              # Claude AI skills for development
```

### Key Files

- **src/App.tsx** - Main application logic, file upload, Supabase queries
- **src/utils/dataUtils.ts** - Trading metrics calculations, CSV parsing
- **src/hooks/usePortfolio.ts** - Portfolio analysis, equity curves
- **src/hooks/useMetrics.ts** - Metrics computation, sorting, filtering

### Running Linter

```bash
npm run lint
```

### Documentation

- **User Guide:** See this README
- **Developer Docs:** See `dev-docs/` folder
- **Migration Plan:** See `dev-docs/supabase-migration-plan.md`

## Contributing

This project is for the 5minfutures trading community. For questions or contributions:

1. Review `dev-docs/project-overview.md` for architecture
2. Follow coding standards in `.claude/skills/coding-standards/`
3. Test thoroughly before committing
4. Use conventional commit messages

## React + Vite Template Info

This project is built with Vite for fast development:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) - Uses Babel for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) - Uses SWC for Fast Refresh

React Compiler is not enabled due to performance impact. See [React documentation](https://react.dev/learn/react-compiler/installation) to add it.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

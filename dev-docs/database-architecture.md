# Futures Arena: Database Architecture

**1. System Overview**
The Futures Arena data layer is built on PostgreSQL (hosted via Supabase). The schema is designed to track trading performance data using a clean One-to-Many relational model between high-level Strategies and their individual executions (Trades).
**Current Volume:** ~6,000+ active trade records.

**2. Active Schema (public)**

**A. Table: public.strategies**
*   **Role:** Parent Table
*   **Description:** Defines the metadata and configuration for specific trading algorithms/strategies.
*   **Row Count:** ~2

| Column Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | bigint | PK | Sequential internal database ID. |
| `strategy_id` | text | Unique / BK | Business Key. The text-based identifier used for Foreign Key joins (e.g., "testStrategy3"). |
| `display_name` | text | NOT NULL | Human-readable name for the UI. |
| `market` | text | NOT NULL | The asset class or ticker being traded (e.g., "NQ", "ES"). |
| `direction` | text | NOT NULL | Strategy bias (e.g., "Long", "Short", "Both"). |
| `contract_multiplier` | numeric | Default 1.0 | Multiplier for P&L calculations. |
| `is_intraday` | boolean | Default false | Flag for intraday vs. swing strategies. |
| `created_at` | timestamp | Default now() | Record creation timestamp. |

**B. Table: public.trades**
*   **Role:** Child Table
*   **Description:** Contains the immutable log of individual trade executions.
*   **Row Count:** ~6,055+

| Column Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | bigint | PK | Sequential internal database ID. |
| `strategy_id` | text | FK | Links to `strategies.strategy_id`. |
| `trade_date` | date | NOT NULL | The date the trade was closed. |
| `trade_time` | time | NOT NULL | The timestamp of the trade. |
| `profit` | numeric | NOT NULL | Net P&L for the specific trade. |
| `trade_type` | text | NULL | Metadata tag (e.g., "Entry", "Exit", "Stop"). |
| `notes` | text | NULL | Optional context or journal notes. |

**3. Entity Relationships**
The system relies on a single, critical relationship using text-based identifiers rather than integer IDs for cross-referencing.
*   **Relationship Type:** One-to-Many (1:N)
*   **Join Condition:**
    ```sql
    strategies.strategy_id = trades.strategy_id
    ```
*   **Note:** The application joins on the text column `strategy_id`, NOT the sequential `id`.

**4. Legacy / Dormant Schema**
The following tables exist in the database but are currently unused (0 rows). They appear to be artifacts of a planned "Portfolio" feature.
*   `public.portfolios`: Intended for grouping strategies.
*   `public.portfolio_strategies`: Junction table for Many-to-Many relationships between Portfolios and Strategies.
*   **Recommendation for Devs:** Ignore these tables for current maintenance tasks.

**5. Critical Configuration**
⚠️ **Important for Environment Setup:**
The application requires fetching large datasets (6k+ rows) in single queries. The default Supabase PostgREST limits have been overridden.
*   **Setting:** API Settings > PostgREST > Max Rows
*   **Configured Value:** 10,000 (Default is 1,000)
*   **Impact:** If migrating to a new Supabase project, this setting must be manually updated or the dashboard "Load Data" feature will truncate results.

TRACK_ID=PS6

# Transaction Risk Investigator

A production-quality hackathon submission for **NexusTiQ24**, Track PS6 — *Banking: Transaction Risk Investigation Assistant.*

---

## Overview

This system aids bank fraud desk investigators in reviewing customer transaction histories. It provides a clear, evidence-based investigation report without ever rendering a final fraud verdict.

The architecture strictly separates **deterministic risk evaluation** from **generative AI explanation** — all anomaly detection is rule-based; Gemini only narrates and prioritizes.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (SPA)                       │
│   index.html  ·  style.css  ·  app.js (vanilla JS + CSS)   │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API (FastAPI)
┌───────────────────────────▼─────────────────────────────────┐
│                          app.py                             │
│  GET /api/customers                                         │
│  GET /api/investigations/overview                           │
│  GET /api/investigate/{customer_id}                         │
└────┬──────────────┬───────────────┬──────────────┬──────────┘
     │              │               │              │
┌────▼────┐  ┌──────▼──────┐ ┌─────▼────┐  ┌─────▼─────┐
│baseline │  │   rules.py  │ │connections│  │  llm.py   │
│  .py    │  │             │ │   .py     │  │ (Gemini)  │
└─────────┘  └─────────────┘ └──────────┘  └───────────┘
     ▲                                           ▲
     │ reads                                     │ reads env
┌────┴──────────────────────┐         ┌──────────┴────────┐
│  data/transactions.csv    │         │  GEMINI_API_KEY    │
│  data/customers.json      │         └───────────────────┘
└───────────────────────────┘
```

---

## Features

### 1. Automatic Overview Engine (`app.py` + `app.js`)
On dashboard load, **all customers are analyzed automatically** using the deterministic rule engine. Investigators see a live summary without having to open each customer manually.

**Dashboard metrics:**

| Metric | Description |
|---|---|
| Customers Reviewed | Total number of customers analyzed |
| Attention Required | Customers with at least one triggered rule |
| No Attention Required | Customers with clean transaction histories |
| Flagged Transactions | Total count of uniquely flagged transactions |

Customers are split into two live queues:
- **Customers Requiring Attention** — shows flagged tx count, main signals, deviation multiplier, and "View Investigation" button
- **Customers With No Attention Required** — shows "View Details" button

### 2. Baseline Engine (`src/baseline.py`)
Computes a customer's typical behavioral profile **live from `transactions.csv`** at investigation time.

The engine dynamically splits the transaction history into two windows:
- **Baseline window** — all data older than the last 7 days (clean historical profile)
- **Evaluation window** — the most recent 7 days (what is being assessed)

Computed baseline metrics:

| Metric | Description |
|---|---|
| `median_amount` | Median transaction amount (baseline) |
| `p90_amount` | 90th percentile amount (threshold for large transfers) |
| `typical_active_hours` | Min-to-max hour range of historical transactions |
| `known_payees` | Unique payees seen in baseline history |
| `typical_channel` | Most frequent channel (e.g., Web, Mobile_API) |
| `avg_tx_per_week` | Average weekly transaction frequency |
| `typical_transaction` | Median single transaction value |

This design ensures the baseline is **never contaminated** by the anomaly window.

### 3. Rules Engine (`src/rules.py`)
Pure Python deterministic rules that produce a structured evidence pack. Four independent rules are run on the evaluation window:

| Rule | Logic | Triggers when... |
|---|---|---|
| **Large Transfer** | `amount > p90_baseline` | Any evaluation tx exceeds the 90th percentile of baseline amounts |
| **New Payee Burst** | `payee not in known_payees AND count > 1` | Two or more transactions go to a payee never seen in baseline history |
| **Odd Hours Activity** | `hour < min_hour OR hour > max_hour` | Any transaction occurs outside the customer's typical active hours range |
| **Pattern Break** | `channel != typical_channel` | Any transaction uses a channel different from the most common baseline channel |

Each finding returns: `rule_name`, `transaction_ids` (list), `observed_vs_baseline` (plain-English description).

### 4. Connections Analysis (`src/connections.py`)
Deterministic logic that groups flagged transactions into plain-language connection statements across three dimensions:

| Connection Type | Logic |
|---|---|
| **Shared Payee** | Multiple flagged transactions share the same payee |
| **Tight Time Window** | Two or more flagged transactions occur within 30 minutes of each other |
| **Rule Co-occurrence** | A single transaction triggers two or more independent rules simultaneously |

### 5. LLM Synthesis (`src/llm.py` — Gemini 1.5 Flash)
Receives the complete evidence pack (baseline + findings + connections) and produces:
- `investigation_narrative` — a paragraph explaining **why** the signals are significant given the baseline
- `check_first` — a prioritized recommendation on where a human investigator should focus first

**Critical constraints enforced via system prompt:**
- Gemini **never** states or implies that fraud occurred
- Every claim must be grounded strictly in the provided evidence pack
- Gemini does **not** decide what is anomalous — it only explains what the deterministic engine already found

If `GEMINI_API_KEY` is absent or the API call fails, all deterministic detection continues normally and the narrative section is gracefully skipped.

### 6. Investigation Timeline (`frontend/app.js`)
A chronological, scrollable visual timeline of every transaction in the evaluation window, with:
- Date separators for grouped days
- Color-coded nodes: flagged (red) vs. normal
- Inline badges for rule triggers and new payees
- Clickable transaction IDs that scroll to and highlight the matching row in the raw transactions table
- Terminal badge showing final status: Attention Required / No Attention Required

---

## Project Structure

```
transaction-risk-investigator/
│
├── app.py                    # FastAPI server — API routes + static file serving
│
├── src/
│   ├── baseline.py           # Loads CSV, computes baseline profile and evaluation window
│   ├── rules.py              # 4 deterministic risk rules
│   ├── connections.py        # Groups flagged transactions by payee, time, and rule co-occurrence
│   ├── llm.py                # Gemini 1.5 Flash narrative generation
│   └── generate_data.py      # Synthetic data generator (7 customers, ~90 days of history)
│
├── frontend/
│   ├── index.html            # Single-page application shell
│   ├── style.css             # Full dark-mode UI with glassmorphism and animations
│   └── app.js                # Vanilla JS — dashboard, investigation report, timeline rendering
│
├── data/
│   ├── customers.json        # 7 customers (C001–C007)
│   └── transactions.csv      # ~90 days of synthetic transaction history
│
└── requirements.txt          # fastapi, uvicorn, pandas, google-generativeai, python-multipart
```

---

## Data Generation (`src/generate_data.py`)

The script synthesizes realistic transaction histories for 7 customers over a 90-day period.

**Customer profiles:**

| Customer | ID | Profile |
|---|---|---|
| Alice Smith | C001 | Clean — typical Web transactions, known payees |
| Bob Jones | C002 | Clean |
| Charlie Brown | C003 | Clean |
| Diana Prince | C004 | Clean |
| Ethan Hunt | C005 | **Anomalous** — burst of large transfers to `Unknown_Crypto_Exchange` at 2–4 AM via Mobile_API |
| Fiona Gallagher | C006 | **Anomalous** |
| George Miller | C007 | **Anomalous** |

**Normal transaction profile (baseline):**
- Amount: ₹10–₹150
- Hours: 08:00–20:00
- Channel: Web
- Payees: 3 known recurring payees per customer

**Injected anomaly cluster (evaluation window, last 2 days):**
- 4 rapid-fire transactions, each ₹900–₹1,200
- Payee: `Unknown_Crypto_Exchange` (never seen in baseline)
- Time: 02:00–04:00 AM
- Channel: `Mobile_API` (different from typical Web channel)

This design guarantees the baseline remains uncontaminated and creates a stark, clear demo contrast between clean and flagged customers.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/customers` | Returns the full list of customers from `data/customers.json` |
| `GET` | `/api/investigations/overview` | Runs all rules across all customers; returns metrics + attention/clean queues |
| `GET` | `/api/investigate/{customer_id}` | Full investigation for one customer: baseline, findings, connections, LLM narrative, raw transactions |
| `GET` | `/` | Serves the frontend SPA (`frontend/index.html`) |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Optional (recommended) | Google Gemini API key for narrative generation. Detection works without it. |

---

## How to Run

### 1. Clone the repository
```bash
git clone <repo-url>
cd transaction-risk-investigator
```

### 2. Create and activate a virtual environment
```bash
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set your Gemini API key
```bash
# macOS / Linux
export GEMINI_API_KEY="your-gemini-api-key"

# Windows PowerShell
$env:GEMINI_API_KEY="your-gemini-api-key"
```
> Get a free API key at [aistudio.google.com](https://aistudio.google.com). The app runs fully without it — only the AI narrative section is skipped.

### 5. (Optional) Regenerate synthetic data
```bash
python src/generate_data.py
```
The `data/` folder is already pre-populated. Only run this if you want fresh data.

### 6. Start the server
```bash
python app.py
```

### 7. Open the dashboard
Navigate to **http://localhost:8000** in your browser.

The dashboard will automatically analyze all 7 customers and display the live alert overview.

---

## Dashboard Flow

```
Dashboard Loads
  → GET /api/investigations/overview
  → Analyze ALL Customers (deterministic rules)
  → Display Metrics + Split Queues
      ↓
Investigator clicks "View Investigation"
  → GET /api/investigate/{customer_id}
  → Compute Baseline (live from CSV)
  → Run 4 Rules on Evaluation Window
  → Analyze Connections
  → Generate Gemini Narrative
  → Render Full Report
      ↓
  Investigation Timeline
  Deterministic Rule Findings
  Connection Analysis
  AI Investigation Summary
  Raw Transactions Table (clickable IDs)
```

---

## Demo Video Link

[Link to Demo Video Here]

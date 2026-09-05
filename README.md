TRACK_ID=PS6

# Transaction Risk Investigator

A production-quality hackathon submission for NexusTiQ24, track PS6: Banking, Transaction Risk Investigation Assistant.

## What This Project Does

This system aids bank fraud desk investigators in reviewing customer transaction histories. It provides a clear, evidence-based investigation report without ever rendering a final fraud verdict.

The application architecture strictly splits deterministic risk evaluation from generative AI explanation:
1. **Automatic Overview Engine:** On dashboard load, the system automatically analyzes ALL customers using the deterministic rule engine. Investigators see a live summary without having to open each customer manually.
2. **Baseline Engine:** Computes a customer's typical profile (transfer amounts, active hours, known payees, channel) live from historical transactions, isolating the baseline from the investigation window.
3. **Rules Engine:** Pure Python deterministic rules (Large Transfer, New Payee Burst, Odd Hours, Pattern Break) that produce a structured evidence pack comparing observed behavior against the baseline.
4. **Connections Analysis:** Deterministic logic that groups flagged transactions sharing payees, time windows, or rule triggers into plain-language statements.
5. **LLM Synthesis (Gemini):** Receives the evidence pack and connection analysis. Its sole responsibility is explaining why the signals matter and providing a prioritized recommendation for human review. Gemini does NOT decide anomalies, alerts, or fraud — all detection is deterministic.

## Dashboard Flow

```
Dashboard Loads → Analyze ALL Customers → Identify Alerts → Show Overview
  → Investigator selects customer → Detailed Report
```

The overview shows:
- **Customers Reviewed** — total analyzed
- **Attention Required** — customers with triggered rules
- **No Attention Required** — clean customers
- **Flagged Transactions** — total flagged transaction count

Below the metrics, customers are split into two live queues:
- **Customers Requiring Attention** — with flagged tx count, main signals, deviation, and "View Investigation"
- **Customers With No Attention Required** — clean customers with "View Details"

Clicking **View Investigation** opens the detailed report:
- Customer baseline profile
- ATTENTION REQUIRED / NO ATTENTION REQUIRED status badge
- Deterministic rule findings (with clickable transaction IDs that scroll to and highlight the matching raw transaction)
- Connection analysis (payee groups, time windows, rule co-occurrence)
- Gemini AI investigation summary (narrative + "Check First" recommendation)
- Full raw transactions table

## Data Generation

The project includes a `generate_data.py` script that synthesizes realistic transaction histories for 6-8 customers.
- The majority of customers have completely clean profiles.
- A subset of customers have deliberately seeded anomaly clusters (e.g., bursts of large transfers to unknown payees at odd hours).
This ensures a stark, clear contrast between "No Attention Required" and "Attention Required" scenarios during the demo. The baseline is computed dynamically excluding the anomaly window to ensure the baseline remains uncontaminated.

## Environment Variables

- `GEMINI_API_KEY`: Required. Your Google Gemini API Key used for the generative narrative layer. (e.g. `export GEMINI_API_KEY="your_key"`)
- If the key is missing or Gemini is unavailable, all deterministic detection still works normally — only the narrative is skipped.

## How to Run

1. Clone this repository freshly.
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set your environment variable:
   ```bash
   export GEMINI_API_KEY="your-gemini-key"
   ```
   (On Windows PowerShell: `$env:GEMINI_API_KEY="your-gemini-key"`)
4. Start the application:
   ```bash
   python app.py
   ```
5. Open your browser and navigate to `http://localhost:8000`.
6. The dashboard will automatically analyze all customers and display the alert overview.

## Demo Video Link

[Link to Demo Video Here]

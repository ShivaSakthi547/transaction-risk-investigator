TRACK_ID=PS6

# Transaction Risk Investigator

A production-quality hackathon submission for NexusTiQ24, track PS6: Banking, Transaction Risk Investigation Assistant.

## What This Project Does

This system aids bank fraud desk investigators in reviewing customer transaction histories. It provides a clear, evidence-based investigation report without ever rendering a final fraud verdict. 

The application architecture strictly splits deterministic risk evaluation from generative AI explanation:
1. **Baseline Engine:** Computes a customer's typical profile (transfer amounts, active hours, known payees, channel) live from historical transactions, isolating the baseline from the investigation window.
2. **Rules Engine:** Pure Python deterministic rules (Large Transfer, New Payee Burst, Odd Hours, Pattern Break) that produce a structured evidence pack comparing observed behavior against the baseline.
3. **Connections Analysis:** Deterministic logic that groups flagged transactions sharing payees, time windows, or rule triggers into plain-language statements.
4. **LLM Synthesis (Gemini):** Receives the evidence pack and connection analysis. Its sole responsibility is explaining why the signals matter and providing a prioritized recommendation for human review.

## Data Generation

The project includes a `generate_data.py` script that synthesizes realistic transaction histories for 6-8 customers. 
- The majority of customers have completely clean profiles.
- A subset of customers have deliberately seeded anomaly clusters (e.g., bursts of large transfers to unknown payees at odd hours).
This ensures a stark, clear contrast between "No attention required" and "Attention required" scenarios during the demo. The baseline is computed dynamically excluding the anomaly window to ensure the baseline remains uncontaminated.

## Environment Variables

- `GEMINI_API_KEY`: Required. Your Google Gemini API Key used for the generative narrative layer. (e.g. `export GEMINI_API_KEY="your_key"`)

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

## Demo Video Link

[Link to Demo Video Here]

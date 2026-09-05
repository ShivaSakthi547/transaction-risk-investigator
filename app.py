import os
import json
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.baseline import load_transactions, compute_baseline
from src.rules import evaluate_rules
from src.connections import analyze_connections
from src.llm import generate_narrative

app = FastAPI(title="Transaction Risk Investigation Assistant")

# We will load transactions once at startup or dynamically per request.
# The prompt says: "computed live from transactions.csv at investigation time"
# We will reload the dataframe for each request to fulfill the "live" requirement strictly,
# though caching would be fine too. We'll load per request to be safe.

# Mount static files for CSS/JS
# Moved to bottom to avoid overriding API routes
# Let's remove the redundant serve_index to simplify.

@app.get("/api/customers")
async def get_customers():
    try:
        with open("data/customers.json", "r") as f:
            customers = json.load(f)
        return {"customers": customers}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to load customers.")

@app.get("/api/investigations/overview")
async def get_overview():
    try:
        with open("data/customers.json", "r") as f:
            customers = json.load(f)
            
        df = load_transactions("data/transactions.csv")
        if df.empty:
            raise HTTPException(status_code=500, detail="Failed to load transactions.")
            
        monitored = len(customers)
        attention_required = 0
        no_attention_required = 0
        flagged_transactions = set()
        
        attention_queue = []
        clean_queue = []
        
        for c in customers:
            cid = c["customer_id"]
            baseline = compute_baseline(cid, df)
            if not baseline:
                continue
                
            findings = evaluate_rules(baseline)
            if findings:
                attention_required += 1
                
                # compute highest deviation
                highest_dev = 1.0
                if baseline['median_amount'] > 0:
                    eval_df = baseline['evaluation_df']
                    if not eval_df.empty:
                        max_amt = eval_df['amount'].max()
                        dev = max_amt / baseline['median_amount']
                        if dev > highest_dev:
                            highest_dev = dev
                            
                c_flagged_txs = set()
                signals = set()
                for f in findings:
                    c_flagged_txs.update(f["transaction_ids"])
                    signals.add(f["rule_name"])
                    
                flagged_transactions.update(c_flagged_txs)
                
                attention_queue.append({
                    "priority_level": 2 if len(findings) >= 2 else 1,
                    "customer_id": cid,
                    "customer_name": c["name"],
                    "signal": " + ".join(list(signals)[:2]),
                    "transactions_count": len(c_flagged_txs),
                    "deviation": f"{highest_dev:.1f}x"
                })
            else:
                no_attention_required += 1
                clean_queue.append({
                    "customer_id": cid,
                    "customer_name": c["name"]
                })
                
        # Sort queue by priority
        attention_queue.sort(key=lambda x: x["priority_level"], reverse=True)
                
        return {
            "metrics": {
                "customers_reviewed": monitored,
                "attention_required": attention_required,
                "no_attention_required": no_attention_required,
                "flagged_transactions": len(flagged_transactions)
            },
            "attention_queue": attention_queue,
            "clean_queue": clean_queue
        }
    except Exception as e:
        print("Overview Error:", e)
        raise HTTPException(status_code=500, detail="Failed to load overview data.")

@app.get("/api/investigate/{customer_id}")
async def investigate(customer_id: str):
    df = load_transactions("data/transactions.csv")
    if df.empty:
        raise HTTPException(status_code=500, detail="Failed to load transactions.")
        
    baseline = compute_baseline(customer_id, df)
    if not baseline:
        raise HTTPException(status_code=404, detail="Customer not found or no data available.")
        
    # Evaluate rules
    findings = evaluate_rules(baseline)
    
    # Convert datetime to string for JSON serialization
    eval_records = baseline['evaluation_df'].copy()
    eval_records['datetime'] = eval_records['datetime'].astype(str)
    raw_txs = eval_records.to_dict(orient='records')
    
    # Build behavioral fingerprint
    fingerprint = {
        "typical_transaction": f"₹{baseline['typical_transaction']:,.0f}",
        "typical_transfer": f"₹{baseline['median_amount']:,.0f} – ₹{baseline['p90_amount']:,.0f}",
        "typical_active_hours": baseline['typical_active_hours'],
        "known_payees_count": len(baseline['known_payees']),
        "avg_tx_per_week": baseline['avg_tx_per_week'],
        "preferred_channel": baseline['typical_channel'],
        # kept for backward compat
        "known_payees": baseline['known_payees'],
        "typical_channel": baseline['typical_channel'],
    }

    # If no findings, no attention required, return early
    if not findings:
        return {
            "customer_id": customer_id,
            "status": "no_attention",
            "fingerprint": fingerprint,
            "baseline": {
                "typical_transfer": fingerprint["typical_transfer"],
                "typical_active_hours": baseline['typical_active_hours'],
                "known_payees": baseline['known_payees'],
                "typical_channel": baseline['typical_channel']
            },
            "findings": [],
            "connections": [],
            "investigation_narrative": "",
            "check_first": "",
            "raw_transactions": raw_txs
        }
        
    # Analyze connections
    connections = analyze_connections(findings, baseline['evaluation_df'])
    
    # Enrich findings with per-transaction deviation multiplier
    enriched_findings = []
    for f in findings:
        enriched = dict(f)
        if f.get("id") == "rule_large_transfer" and baseline['median_amount'] > 0:
            # Find the max amount in flagged transactions
            flagged_rows = baseline['evaluation_df'][
                baseline['evaluation_df']['transaction_id'].isin(f['transaction_ids'])
            ]
            if not flagged_rows.empty:
                max_flagged_amount = flagged_rows['amount'].max()
                multiplier = max_flagged_amount / baseline['median_amount']
                enriched['deviation_label'] = f"₹{max_flagged_amount:,.0f} — {multiplier:.1f}× customer's typical transfer amount"
        enriched_findings.append(enriched)
    
    # Generate Narrative via LLM
    evidence_pack = {
        "customer_id": customer_id,
        "baseline": {
            "typical_transfer": fingerprint["typical_transfer"],
            "typical_active_hours": baseline['typical_active_hours'],
            "known_payees": baseline['known_payees'],
            "typical_channel": baseline['typical_channel']
        },
        "findings": enriched_findings,
        "connections": connections
    }
    
    llm_result = generate_narrative(evidence_pack)
    
    return {
        "customer_id": customer_id,
        "status": "attention_required",
        "fingerprint": fingerprint,
        "baseline": evidence_pack["baseline"],
        "findings": enriched_findings,
        "connections": connections,
        "investigation_narrative": llm_result["investigation_narrative"],
        "check_first": llm_result["check_first"],
        "raw_transactions": raw_txs
    }

# Mount static files for CSS/JS
os.makedirs("frontend", exist_ok=True)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

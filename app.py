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
    
    # If no findings, no attention required, return early
    if not findings:
        return {
            "customer_id": customer_id,
            "status": "no_attention",
            "baseline": {
                "typical_transfer": f"${baseline['median_amount']} - ${baseline['p90_amount']}",
                "typical_active_hours": baseline['typical_active_hours'],
                "known_payees": baseline['known_payees'],
                "typical_channel": baseline['typical_channel']
            },
            "findings": [],
            "connections": [],
            "investigation_narrative": "",
            "check_first": ""
        }
        
    # Analyze connections
    connections = analyze_connections(findings, baseline['evaluation_df'])
    
    # Generate Narrative via LLM
    evidence_pack = {
        "customer_id": customer_id,
        "baseline": {
            "typical_transfer": f"${baseline['median_amount']} - ${baseline['p90_amount']}",
            "typical_active_hours": baseline['typical_active_hours'],
            "known_payees": baseline['known_payees'],
            "typical_channel": baseline['typical_channel']
        },
        "findings": findings,
        "connections": connections
    }
    
    llm_result = generate_narrative(evidence_pack)
    
    return {
        "customer_id": customer_id,
        "status": "attention_required",
        "baseline": evidence_pack["baseline"],
        "findings": findings,
        "connections": connections,
        "investigation_narrative": llm_result["investigation_narrative"],
        "check_first": llm_result["check_first"]
    }

# Mount static files for CSS/JS
os.makedirs("frontend", exist_ok=True)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

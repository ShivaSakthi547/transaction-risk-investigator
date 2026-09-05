import pandas as pd

def run_large_transfer_rule(eval_df: pd.DataFrame, baseline: dict):
    """Flags transactions where the amount exceeds the 90th percentile."""
    p90 = baseline['p90_amount']
    findings = []
    
    flagged = eval_df[eval_df['amount'] > p90]
    if not flagged.empty:
        findings.append({
            "id": "rule_large_transfer",
            "rule_name": "Large Transfer",
            "transaction_ids": flagged['transaction_id'].tolist(),
            "observed_vs_baseline": f"Amounts exceed 90th percentile ({p90})"
        })
    return findings

def run_new_payee_burst_rule(eval_df: pd.DataFrame, baseline: dict):
    """Flags multiple transactions to a payee not in the known_payees list."""
    known_payees = baseline['known_payees']
    findings = []
    
    unknown_payee_txs = eval_df[~eval_df['payee'].isin(known_payees)]
    payee_counts = unknown_payee_txs['payee'].value_counts()
    burst_payees = payee_counts[payee_counts > 1].index.tolist()
    
    for payee in burst_payees:
        txs = unknown_payee_txs[unknown_payee_txs['payee'] == payee]
        findings.append({
            "id": "rule_new_payee_burst",
            "rule_name": "New Payee Burst",
            "transaction_ids": txs['transaction_id'].tolist(),
            "observed_vs_baseline": f"{len(txs)} transactions to new payee '{payee}' not seen in history"
        })
    return findings

def run_odd_hours_rule(eval_df: pd.DataFrame, baseline: dict):
    """Flags transactions outside typical active hours."""
    min_hour = baseline['min_hour']
    max_hour = baseline['max_hour']
    findings = []
    
    hours = eval_df['datetime'].dt.hour
    flagged = eval_df[(hours < min_hour) | (hours > max_hour)]
    
    if not flagged.empty:
        findings.append({
            "id": "rule_odd_hours",
            "rule_name": "Odd Hours Activity",
            "transaction_ids": flagged['transaction_id'].tolist(),
            "observed_vs_baseline": f"Occurred outside typical hours ({baseline['typical_active_hours']})"
        })
    return findings

def run_pattern_break_rule(eval_df: pd.DataFrame, baseline: dict):
    """Flags transactions that deviate from the typical channel."""
    typical_channel = baseline['typical_channel']
    findings = []
    
    flagged = eval_df[eval_df['channel'] != typical_channel]
    if not flagged.empty:
        findings.append({
            "id": "rule_pattern_break",
            "rule_name": "Pattern Break",
            "transaction_ids": flagged['transaction_id'].tolist(),
            "observed_vs_baseline": f"Used channel other than typical ({typical_channel})"
        })
    return findings

def evaluate_rules(baseline: dict):
    """Runs all rules and aggregates evidence."""
    if not baseline or baseline['evaluation_df'].empty:
        return []
        
    eval_df = baseline['evaluation_df']
    findings = []
    
    findings.extend(run_large_transfer_rule(eval_df, baseline))
    findings.extend(run_new_payee_burst_rule(eval_df, baseline))
    findings.extend(run_odd_hours_rule(eval_df, baseline))
    findings.extend(run_pattern_break_rule(eval_df, baseline))
    
    return findings

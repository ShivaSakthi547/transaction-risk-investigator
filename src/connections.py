import pandas as pd

def analyze_connections(findings: list, eval_df: pd.DataFrame):
    """
    Analyzes connections among flagged transactions.
    Groups by payee, time window, and multiple rules.
    """
    if not findings:
        return []
        
    # Get all unique flagged transaction IDs
    flagged_tx_ids = set()
    for f in findings:
        flagged_tx_ids.update(f['transaction_ids'])
        
    if not flagged_tx_ids:
        return []
        
    # Filter eval_df to only flagged transactions
    flagged_df = eval_df[eval_df['transaction_id'].isin(flagged_tx_ids)].copy()
    
    connections = []
    
    # 1. Group by Payee
    payee_groups = flagged_df.groupby('payee')
    for payee, group in payee_groups:
        if len(group) > 1:
            connections.append({
                "transaction_ids": group['transaction_id'].tolist(),
                "narrative": f"{len(group)} flagged transactions involve the same payee '{payee}'."
            })
            
    # 2. Tight Time Window (e.g. multiple transactions within 30 minutes)
    if len(flagged_df) > 1:
        # Sort by datetime
        flagged_df = flagged_df.sort_values(by='datetime')
        time_diffs = flagged_df['datetime'].diff()
        
        # Simple heuristic: if any transactions are within 30 minutes of each other
        tight_group = []
        for i in range(1, len(flagged_df)):
            if time_diffs.iloc[i].total_seconds() <= 1800: # 30 mins
                tight_group.append(flagged_df.iloc[i-1]['transaction_id'])
                tight_group.append(flagged_df.iloc[i]['transaction_id'])
                
        tight_group = list(set(tight_group))
        if len(tight_group) > 1:
            connections.append({
                "transaction_ids": tight_group,
                "narrative": f"{len(tight_group)} flagged transactions occurred within a tight time window (< 30 minutes)."
            })
            
    # 3. Rule Co-occurrence
    tx_rule_map = {tx_id: [] for tx_id in flagged_tx_ids}
    for f in findings:
        for tx_id in f['transaction_ids']:
            tx_rule_map[tx_id].append(f['rule_name'])
            
    co_occurring_txs = [tx for tx, rules in tx_rule_map.items() if len(rules) > 1]
    if co_occurring_txs:
        connections.append({
            "transaction_ids": co_occurring_txs,
            "narrative": f"{len(co_occurring_txs)} transactions triggered multiple independent risk rules."
        })
        
    return connections

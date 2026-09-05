import pandas as pd
from datetime import datetime, timedelta

def load_transactions(filepath="data/transactions.csv"):
    """Loads transactions into a pandas DataFrame."""
    try:
        df = pd.read_csv(filepath)
        df['datetime'] = pd.to_datetime(df['date'] + ' ' + df['time'])
        return df
    except Exception as e:
        return pd.DataFrame()

def compute_baseline(customer_id: str, df: pd.DataFrame, evaluation_window_days: int = 7):
    """
    Computes the baseline profile for a customer, excluding the evaluation window.
    """
    customer_df = df[df['customer_id'] == customer_id].copy()
    if customer_df.empty:
        return None
        
    # Determine the split between baseline and evaluation window
    max_date = customer_df['datetime'].max()
    cutoff_date = max_date - timedelta(days=evaluation_window_days)
    
    baseline_df = customer_df[customer_df['datetime'] < cutoff_date]
    evaluation_df = customer_df[customer_df['datetime'] >= cutoff_date]
    
    # If no baseline data, fall back to evaluating all (shouldn't happen with our generated data)
    if baseline_df.empty:
        baseline_df = customer_df
    
    # Calculate baseline metrics
    median_amount = baseline_df['amount'].median()
    p90_amount = baseline_df['amount'].quantile(0.90)
    
    # Active hours
    hours = baseline_df['datetime'].dt.hour
    if not hours.empty:
        typical_hours = hours.mode().tolist()
        min_hour = hours.min()
        max_hour = hours.max()
        typical_active_hours = f"{min_hour:02d}:00 - {max_hour:02d}:00"
    else:
        typical_active_hours = "Unknown"
        min_hour = 0
        max_hour = 23
        
    known_payees = baseline_df['payee'].unique().tolist()
    
    if not baseline_df['channel'].empty:
        typical_channel = baseline_df['channel'].mode()[0]
    else:
        typical_channel = "Unknown"
    
    # Avg transactions per week from baseline period
    baseline_days = (baseline_df['datetime'].max() - baseline_df['datetime'].min()).days + 1
    if baseline_days > 0:
        avg_tx_per_week = round((len(baseline_df) / baseline_days) * 7, 1)
    else:
        avg_tx_per_week = len(baseline_df)
        
    # Typical single transaction median (same as median_amount but named clearly)
    typical_transaction = round(baseline_df['amount'].median(), 2) if pd.notnull(baseline_df['amount'].median()) else 0.0
        
    return {
        "median_amount": round(median_amount, 2) if pd.notnull(median_amount) else 0.0,
        "p90_amount": round(p90_amount, 2) if pd.notnull(p90_amount) else 0.0,
        "typical_active_hours": typical_active_hours,
        "min_hour": int(min_hour),
        "max_hour": int(max_hour),
        "known_payees": known_payees,
        "typical_channel": typical_channel,
        "avg_tx_per_week": avg_tx_per_week,
        "typical_transaction": typical_transaction,
        "evaluation_df": evaluation_df
    }

if __name__ == "__main__":
    df = load_transactions()
    print("Test baseline for C005:")
    print(compute_baseline("C005", df))

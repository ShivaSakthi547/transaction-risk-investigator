import json
import csv
import random
from datetime import datetime, timedelta
import os

# Set random seed for reproducibility
random.seed(42)

def generate_customers():
    return [
        {"customer_id": "C001", "name": "Alice Smith", "account_opened_date": "2023-01-15"},
        {"customer_id": "C002", "name": "Bob Jones", "account_opened_date": "2022-11-05"},
        {"customer_id": "C003", "name": "Charlie Brown", "account_opened_date": "2024-02-20"},
        {"customer_id": "C004", "name": "Diana Prince", "account_opened_date": "2021-08-10"},
        {"customer_id": "C005", "name": "Ethan Hunt", "account_opened_date": "2023-06-01"},
        {"customer_id": "C006", "name": "Fiona Gallagher", "account_opened_date": "2020-03-12"},
        {"customer_id": "C007", "name": "George Miller", "account_opened_date": "2023-09-30"}
    ]

def generate_transactions_for_customer(customer_id, is_anomalous, start_date, end_date):
    transactions = []
    current_date = start_date
    tx_id_counter = 1
    
    # Typical profile
    typical_payees = [f"Payee_A_{customer_id}", f"Payee_B_{customer_id}", f"Payee_C_{customer_id}"]
    typical_amount_range = (10, 150)
    typical_hour_range = (8, 20)
    typical_channel = "Web"
    
    while current_date <= end_date:
        # Generate 0 to 3 transactions per day
        num_tx = random.randint(0, 3)
        for _ in range(num_tx):
            # Normal transaction
            hour = random.randint(*typical_hour_range)
            minute = random.randint(0, 59)
            tx_datetime = datetime.combine(current_date, datetime.min.time()) + timedelta(hours=hour, minutes=minute)
            
            amount = round(random.uniform(*typical_amount_range), 2)
            payee = random.choice(typical_payees)
            channel = typical_channel
            
            transactions.append({
                "transaction_id": f"T_{customer_id}_{tx_id_counter:04d}",
                "customer_id": customer_id,
                "date": tx_datetime.strftime("%Y-%m-%d"),
                "time": tx_datetime.strftime("%H:%M:%S"),
                "description": f"Payment to {payee}",
                "payee": payee,
                "amount": amount,
                "channel": channel
            })
            tx_id_counter += 1
            
        current_date += timedelta(days=1)
        
    # Inject anomalies at the very end of the period for anomalous customers
    if is_anomalous:
        anomaly_date = end_date - timedelta(days=1)
        anomaly_hour = random.choice([2, 3, 4]) # Odd hours
        new_payee = "Unknown_Crypto_Exchange"
        
        # Burst of 4 large transactions
        for i in range(4):
            tx_datetime = datetime.combine(anomaly_date, datetime.min.time()) + timedelta(hours=anomaly_hour, minutes=i*5)
            transactions.append({
                "transaction_id": f"T_{customer_id}_{tx_id_counter:04d}",
                "customer_id": customer_id,
                "date": tx_datetime.strftime("%Y-%m-%d"),
                "time": tx_datetime.strftime("%H:%M:%S"),
                "description": f"Transfer to {new_payee}",
                "payee": new_payee,
                "amount": round(random.uniform(900, 1200), 2), # Large transfer
                "channel": "Mobile_API" # Pattern break
            })
            tx_id_counter += 1

    return transactions

def main():
    os.makedirs('data', exist_ok=True)
    
    customers = generate_customers()
    with open('data/customers.json', 'w') as f:
        json.dump(customers, f, indent=4)
        
    # 4 clean, 3 anomalous
    anomalous_customers = ["C005", "C006", "C007"]
    
    start_date = datetime.now() - timedelta(days=90)
    end_date = datetime.now()
    
    all_transactions = []
    for c in customers:
        is_anom = c["customer_id"] in anomalous_customers
        txs = generate_transactions_for_customer(c["customer_id"], is_anom, start_date, end_date)
        all_transactions.extend(txs)
        
    # Sort transactions by date and time just in case
    all_transactions.sort(key=lambda x: (x["date"], x["time"]))
    
    with open('data/transactions.csv', 'w', newline='') as f:
        fieldnames = ["transaction_id", "customer_id", "date", "time", "description", "payee", "amount", "channel"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_transactions)
        
    print(f"Generated {len(customers)} customers and {len(all_transactions)} transactions.")

if __name__ == "__main__":
    main()

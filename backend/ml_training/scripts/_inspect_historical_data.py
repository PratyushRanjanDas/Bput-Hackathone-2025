"""Quick dataset inspection for historical_loss_data.csv
Generates summary stats and diagnostics printed to stdout.
"""
import pandas as pd
from pathlib import Path

csv_path = Path(__file__).resolve().parents[2] / 'data' / 'historical_loss_data.csv'

def main():
    print('Reading:', csv_path)
    df = pd.read_csv(csv_path, parse_dates=['timestamp'])
    print('\nColumns:', list(df.columns))
    print('\nRows:', len(df))
    print('\nDate range:', df['timestamp'].min(), '->', df['timestamp'].max())

    # Basic numeric stats
    print('\nNumeric summary:')
    print(df.describe().T[['count','mean','std','min','25%','50%','75%','max']])

    # Non-zero counts
    nonzero_ideal = (df['ideal_power_kw'] > 0.01).sum()
    nonzero_actual = (df['actual_power_kw'] > 0.01).sum()
    nonzero_loss = (df['energy_loss_kw'] > 0.001).sum()
    print(f"\nNon-night rows (ideal_power_kw>0.01): {nonzero_ideal} / {len(df)}")
    print(f"Rows with actual_power>0.01: {nonzero_actual}")
    print(f"Rows with energy_loss>0.001: {nonzero_loss}")

    # Top loss percent events
    df_day = df.copy()
    df_day['loss_pct'] = df_day['energy_loss_kw'] / (df_day['ideal_power_kw'].replace(0, pd.NA))
    top = df_day.sort_values('loss_pct', ascending=False).head(10)[['timestamp','ideal_power_kw','actual_power_kw','energy_loss_kw','loss_pct','days_since_cleaning','cloud_cover_percentage']]
    print('\nTop 10 loss_pct events (may include inf due to division by zero):')
    print(top.to_string(index=False))

if __name__ == '__main__':
    main()

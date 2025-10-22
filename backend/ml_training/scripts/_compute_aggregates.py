import pandas as pd

df = pd.read_csv('backend/data/historical_loss_data.csv', parse_dates=['timestamp'])
# daylight rows
day = df[df['ideal_power_kw']>0.01].copy()
print('rows total:', len(df))
print('rows daylight:', len(day))
print('mean energy_loss (all):', df['energy_loss_kw'].mean())
print('mean energy_loss (daylight):', day['energy_loss_kw'].mean())
# compute loss percent safely
import numpy as np
loss_pct = (day['energy_loss_kw'] / day['ideal_power_kw']).replace([np.inf, -np.inf], np.nan)
print('mean loss % (daylight):', loss_pct.mean())
print('median days_since_cleaning (daylight):', day['days_since_cleaning'].median())
print('max days_since_cleaning:', df['days_since_cleaning'].max())
print('\nloss percent quantiles (daylight):')
print(loss_pct.quantile([0.5,0.75,0.9,0.95,0.99]))

"""Evaluate saved loss prediction model against historical dataset.
Produces plots and a small CSV summary in `backend/ml_training/reports/`.
"""
import os
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT = Path(__file__).resolve().parents[2]
DATA_CSV = ROOT / 'data' / 'historical_loss_data.csv'
MODEL_PKL = ROOT / 'ml_training' / 'saved_model' / 'loss_prediction_model.pkl'
REPORT_DIR = ROOT / 'ml_training' / 'reports'
REPORT_DIR.mkdir(parents=True, exist_ok=True)

def load():
    df = pd.read_csv(DATA_CSV, parse_dates=['timestamp'])
    model = joblib.load(MODEL_PKL)
    return df, model

def evaluate():
    df, model = load()
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_year'] = df['timestamp'].dt.dayofyear

    features = ['temperature_celsius', 'cloud_cover_percentage', 'panel_age_in_days', 'days_since_cleaning', 'hour', 'day_of_year']
    mask_day = df['ideal_power_kw'] > 0.01 if 'ideal_power_kw' in df.columns else pd.Series(True, index=df.index)
    X = df.loc[mask_day, features]
    y = df.loc[mask_day, 'energy_loss_kw']

    preds = model.predict(X)
    df_eval = df.loc[mask_day].copy()
    df_eval['predicted_loss_kw'] = preds
    df_eval['residual_kw'] = df_eval['energy_loss_kw'] - df_eval['predicted_loss_kw']

    mae = mean_absolute_error(df_eval['energy_loss_kw'], df_eval['predicted_loss_kw'])
    # compute RMSE compatibly across sklearn versions
    rmse = np.sqrt(mean_squared_error(df_eval['energy_loss_kw'], df_eval['predicted_loss_kw']))

    print('Evaluation:')
    print('Rows evaluated:', len(df_eval))
    print('MAE:', mae)
    print('RMSE:', rmse)

    # save summary CSV
    summary_csv = REPORT_DIR / 'evaluation_summary.csv'
    summary = {
        'rows_evaluated': len(df_eval),
        'mae_kw': mae,
        'rmse_kw': rmse,
    }
    pd.Series(summary).to_csv(summary_csv)

    # predicted vs actual scatter
    plt.figure(figsize=(6,6))
    plt.scatter(df_eval['energy_loss_kw'], df_eval['predicted_loss_kw'], s=4, alpha=0.4)
    plt.plot([df_eval['energy_loss_kw'].min(), df_eval['energy_loss_kw'].max()], [df_eval['energy_loss_kw'].min(), df_eval['energy_loss_kw'].max()], 'r--')
    plt.xlabel('Actual loss (kW)')
    plt.ylabel('Predicted loss (kW)')
    plt.title('Predicted vs Actual Energy Loss')
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(REPORT_DIR / 'predicted_vs_actual.png', dpi=150)
    plt.close()

    # residual histogram
    plt.figure(figsize=(6,4))
    plt.hist(df_eval['residual_kw'], bins=80)
    plt.xlabel('Residual (kW)')
    plt.title('Residual Distribution')
    plt.tight_layout()
    plt.savefig(REPORT_DIR / 'residual_histogram.png', dpi=150)
    plt.close()

    # grouped MAE by hour
    grouped = df_eval.groupby('hour').apply(lambda g: mean_absolute_error(g['energy_loss_kw'], g['predicted_loss_kw']))
    grouped.index.name = 'hour'
    grouped.name = 'mae_kw'
    grouped.to_csv(REPORT_DIR / 'mae_by_hour.csv')

    # grouped MAE by cloud buckets
    bins = [0,10,25,50,75,100]
    df_eval['cloud_bucket'] = pd.cut(df_eval['cloud_cover_percentage'], bins=bins, include_lowest=True)
    grouped_cloud = df_eval.groupby('cloud_bucket').apply(lambda g: mean_absolute_error(g['energy_loss_kw'], g['predicted_loss_kw']))
    grouped_cloud.name = 'mae_kw'
    grouped_cloud.to_csv(REPORT_DIR / 'mae_by_cloud_bucket.csv')

    print('Reports written to', REPORT_DIR)

if __name__ == '__main__':
    evaluate()

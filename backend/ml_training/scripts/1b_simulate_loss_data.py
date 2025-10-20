import pandas as pd
import numpy as np
import os

def simulate_loss_data(num_records=8760*2, output_path='../../data/historical_loss_data.csv'):
    """
    Generates simulated solar data including soiling and degradation effects
    to train a loss prediction model.
    """
    print("Starting loss data simulation...")
    np.random.seed(42)

    # Simulate 2 years of data to see degradation effects
    timestamps = pd.date_range(start='2023-01-01', periods=num_records, freq='h')
    # print(timestamps)

    # --- Base Ideal Conditions (same as before) ---
    day_of_year = timestamps.dayofyear
    hour_of_day = timestamps.hour
    temperature_celsius = 25 + (15 * np.sin(2 * np.pi * (day_of_year % 365 - 80) / 365)) + (5 * np.sin(2 * np.pi * (hour_of_day - 6) / 24)) + np.random.normal(0, 2, num_records)
    cloud_cover_percentage = np.random.uniform(0, 100, num_records)
    panel_angle_degrees = 35 # Fixed optimal angle for simplicity

    # Ideal Power Calculation
    base_power = 10 * np.sin(np.pi * hour_of_day / 24) * (1 - cloud_cover_percentage / 120)
    temp_factor = 1 - 0.005 * np.maximum(0, temperature_celsius - 25)
    ideal_power_kw = np.maximum(0, base_power * temp_factor)

    # --- Introduce Factors Causing Loss ---
    
    # 1. Soiling (Dirt on Panels)
    # Simulates dirt accumulating over time, then being reset by "cleaning" (rain)
    days_since_cleaning = np.zeros(num_records)
    for i in range(1, num_records):
        # 1% chance of rain/cleaning each hour
        if np.random.rand() < 0.01:
            days_since_cleaning[i] = 0
        else:
            # Add an hour's worth of days
            days_since_cleaning[i] = days_since_cleaning[i-1] + 1/24.0
    
    # Soiling Loss: Efficiency drops by 0.3% for each day without cleaning, max 20% loss
    soiling_loss_factor = 1 - np.minimum(0.20, days_since_cleaning * 0.003)

    # 2. Degradation (Aging of Panels)
    # Panel loses a small amount of efficiency each day. 0.5% per year.
    panel_age_in_days = (timestamps - timestamps[0]).days
    degradation_loss_factor = 1 - (panel_age_in_days / 365 * 0.005)

    # --- Calculate Actual Power and Energy Loss ---
    actual_power_kw = ideal_power_kw * soiling_loss_factor * degradation_loss_factor
    
    # The target variable for our new model
    energy_loss_kw = ideal_power_kw - actual_power_kw

    # --- Create DataFrame ---
    data = {
        'timestamp': timestamps,
        'temperature_celsius': temperature_celsius,
        'cloud_cover_percentage': cloud_cover_percentage,
        'panel_age_in_days': panel_age_in_days,
        'days_since_cleaning': days_since_cleaning,
        'ideal_power_kw': ideal_power_kw,
        'actual_power_kw': actual_power_kw,
        'energy_loss_kw': energy_loss_kw 
    }
    df = pd.DataFrame(data).round(3)

    # Save to a new CSV
    output_dir = os.path.dirname(output_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    df.to_csv(output_path, index=False)
    print(f"Successfully generated {len(df)} records of loss data.")
    print(f"Data saved to: {os.path.abspath(output_path)}")

if __name__ == '__main__':
    script_dir = os.path.dirname(__file__)
    data_dir = os.path.join(script_dir, '..', '..', 'data')
    output_file_path = os.path.join(data_dir, 'historical_loss_data.csv')
    simulate_loss_data(output_path=output_file_path)
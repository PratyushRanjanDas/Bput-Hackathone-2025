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

    # --- Improved ideal power / irradiance model ---
    # seasonal amplitude: peak in mid-year (northern hemisphere)
    seasonal_amp = 1 + 0.25 * np.sin(2 * np.pi * (day_of_year - 172) / 365.0)
    # solar elevation-like daily shape: zero at night, peak near noon
    sun_angle = np.maximum(0, np.sin(np.pi * (hour_of_day - 6) / 12.0))
    # base clear-sky irradiance proxy (kW per nominal array) scaled by seasonal amp
    clear_irradiance = 5.0 * sun_angle * seasonal_amp
    # cloud attenuation (cloud_cover_percentage in [0,100]) - stronger effect
    cloud_atten = np.clip(1 - (cloud_cover_percentage / 120.0), 0.0, 1.0)
    temp_factor = 1 - 0.004 * np.maximum(0, temperature_celsius - 25)
    ideal_power_kw = np.maximum(0, clear_irradiance * cloud_atten * temp_factor)

    # --- Introduce Factors Causing Loss ---
    # 1. Soiling (Dirt on Panels) with rain-linked cleaning events and persistence
    days_since_cleaning = np.zeros(num_records)

    # Create a correlated cloud process (AR(1)-like) to simulate storm persistence
    cloud = np.zeros(num_records)
    cloud[0] = np.random.beta(2, 5) * 100
    for i in range(1, num_records):
        shock = np.random.beta(2, 5) * 100
        cloud[i] = np.clip(0.8 * cloud[i-1] + 0.2 * shock, 0, 100)
    cloud_cover_percentage = cloud

    # Rain events: more likely during high cloud periods, create multi-hour rain spells
    is_raining = np.zeros(num_records, dtype=bool)
    i = 0
    while i < num_records:
        if cloud_cover_percentage[i] > 60 and np.random.rand() < 0.06:
            length = np.random.randint(3, 24)  # rain lasting 3-24 hours
            is_raining[i:min(num_records, i+length)] = True
            i += length
        else:
            i += 1

    # Accumulate days since cleaning; reset to 0 when it rains (cleaning event)
    for i in range(1, num_records):
        if is_raining[i]:
            days_since_cleaning[i] = 0
        else:
            days_since_cleaning[i] = days_since_cleaning[i-1] + 1/24.0

    # Soiling Loss: efficiency drop per day (adjustable), capped at 25%
    daily_soiling_pct = 0.0025  # 0.25% per day (tunable)
    soiling_loss_factor = 1 - np.minimum(0.25, days_since_cleaning * daily_soiling_pct)

    # 2. Degradation (Aging of Panels)
    panel_age_in_days = (timestamps - timestamps[0]).days
    degradation_loss_factor = 1 - (panel_age_in_days / 365.0 * 0.005)

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
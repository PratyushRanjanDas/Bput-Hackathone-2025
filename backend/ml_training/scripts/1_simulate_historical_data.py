import pandas as pd
import numpy as np
import os

def simulate_solar_data(num_records=8760, output_path='../../data/historical_solar_data.csv'):
    """
    Generates simulated historical solar panel data and saves it to a CSV file.

    Args:
        num_records (int): The number of hourly records to generate (default is 1 year).
        output_path (str): The relative path to save the output CSV file.
    """
    print("Starting data simulation...")
    # Set a seed for reproducibility
    np.random.seed(42)

    # Create a date range for one year of hourly data
    timestamps = pd.date_range(start='2024-01-01', periods=num_records, freq='h')

    # Simulate weather conditions
    # Temperature (seasonal and daily variation)
    day_of_year = timestamps.dayofyear
    hour_of_day = timestamps.hour
    seasonal_temp_variation = 15 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
    daily_temp_variation = 5 * np.sin(2 * np.pi * (hour_of_day - 6) / 24)
    temperature_celsius = 10 + seasonal_temp_variation + daily_temp_variation + np.random.normal(0, 2, num_records)

    # Cloud cover (0% to 100%)
    cloud_cover_percentage = np.random.uniform(0, 100, num_records)

    # UV Index (higher during the day, lower cloud cover)
    uv_index = np.maximum(0, 10 * np.sin(np.pi * hour_of_day / 24) * (1 - cloud_cover_percentage / 150) + np.random.normal(0, 0.5, num_records))
    uv_index = np.clip(uv_index, 0, 12)

    # Simulate panel settings
    panel_angle_degrees = np.random.choice([20, 30, 40, 50], size=num_records) # Simulating different fixed angles

    # Simulate Power Output (dependent on other factors)
    # Base power is heavily influenced by UV index and time of day
    base_power = uv_index * 2 * (1 - cloud_cover_percentage / 120)

    # Temperature efficiency factor (efficiency drops slightly at very high temps)
    temp_factor = 1 - 0.005 * np.maximum(0, temperature_celsius - 25)

    # Angle efficiency factor (simple model assuming 30-40 is optimal)
    angle_factor = 1 - 0.01 * abs(panel_angle_degrees - 35)

    # Combine factors to get final power output
    power_output_kw = base_power * temp_factor * angle_factor
    power_output_kw = np.maximum(0, power_output_kw + np.random.normal(0, 0.05, num_records)) # Add some noise and ensure no negative power

    # Create DataFrame
    data = {
        'timestamp': timestamps,
        'temperature_celsius': temperature_celsius,
        'cloud_cover_percentage': cloud_cover_percentage,
        'uv_index': uv_index,
        'panel_angle_degrees': panel_angle_degrees,
        'power_output_kw': power_output_kw
    }
    df = pd.DataFrame(data)
    df = df.round(2)

    # Ensure the output directory exists
    output_dir = os.path.dirname(output_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Save to CSV
    df.to_csv(output_path, index=False)
    print(f"Successfully generated {len(df)} records.")
    print(f"Data saved to: {os.path.abspath(output_path)}")

if __name__ == '__main__':
    # The script is being run directly.
    # We construct the path relative to this script's location.
    # backend/ml_training/scripts/ -> backend/data/
    script_dir = os.path.dirname(__file__)
    data_dir = os.path.join(script_dir, '..', '..', 'data')
    output_file_path = os.path.join(data_dir, 'historical_solar_data.csv')
    
    simulate_solar_data(output_path=output_file_path)
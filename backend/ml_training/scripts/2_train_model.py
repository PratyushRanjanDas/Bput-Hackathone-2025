import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score
import joblib
import os

def train_model(data_path='../../data/historical_solar_data.csv', model_output_path='../../ml_training/saved_model/solar_efficiency_model.pkl'):
    """
    Loads data, trains a model to predict power output, and saves the model.
    """
    print("Starting model training...")
    
    # 1. Load Data
    try:
        df = pd.read_csv(data_path, parse_dates=['timestamp'])
        print(f"Data loaded successfully from {data_path}")
    except FileNotFoundError:
        print(f"Error: Data file not found at {data_path}")
        print("Please run '1_simulate_historical_data.py' first.")
        return

    # 2. Feature Engineering
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_year'] = df['timestamp'].dt.dayofyear
    df['month'] = df['timestamp'].dt.month

    # Sort data by timestamp to prepare for time-series split
    df = df.sort_values(by='timestamp').reset_index(drop=True)

    # 3. Define Features (X) and Target (y)
    # CORRECTED: 'uv_index' is now removed to prevent data leakage.
    features = [
        'temperature_celsius', 
        'cloud_cover_percentage', 
        'panel_angle_degrees',
        'hour',
        'day_of_year',
        'month'
    ]
    target = 'power_output_kw'

    X = df[features]
    y = df[target]
    print("Features and target defined. 'uv_index' has been correctly excluded.")

    # 4. Split Data using Time-Series method
    split_index = int(len(df) * 0.8)
    X_train = X.iloc[:split_index]
    X_test = X.iloc[split_index:]
    y_train = y.iloc[:split_index]
    y_test = y.iloc[split_index:]
    
    print(f"Data split using time-series method: {len(X_train)} training records and {len(X_test)} testing records.")

    # 5. Initialize and Train the Model
    model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    
    print("Training the RandomForestRegressor model...")
    model.fit(X_train, y_train)
    print("Model training complete.")

    # 6. Evaluate the Model
    predictions = model.predict(X_test)
    score = r2_score(y_test, predictions)
    print(f"Model evaluation complete. R^2 Score: {score:.4f}")

    # 7. Save the Trained Model
    output_dir = os.path.dirname(model_output_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")

    joblib.dump(model, model_output_path)
    print(f"Model saved successfully to: {os.path.abspath(model_output_path)}")


if __name__ == '__main__':
    script_dir = os.path.dirname(__file__)
    data_file_path = os.path.join(script_dir, '..', '..', 'data', 'historical_solar_data.csv')
    model_save_path = os.path.join(script_dir, '..', 'saved_model', 'solar_efficiency_model.pkl')
    
    train_model(data_path=data_file_path, model_output_path=model_save_path)
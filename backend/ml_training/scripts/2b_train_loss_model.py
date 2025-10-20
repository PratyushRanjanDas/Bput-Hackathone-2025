import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import joblib
import os

def train_loss_model(data_path='../../data/historical_loss_data.csv', model_output_path='../../ml_training/saved_model/loss_prediction_model.pkl'):
    """
    Trains a model to directly predict energy loss.
    """
    print("Starting LOSS PREDICTION model training...")
    
    df = pd.read_csv(data_path, parse_dates=['timestamp'])
    print("Loss data loaded successfully.")

    # Feature Engineering
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_year'] = df['timestamp'].dt.dayofyear

    # Define Features (X) and the new Target (y)
    # These are the factors a real system would know at any given time
    features = [
        'temperature_celsius', 
        'cloud_cover_percentage',
        'panel_age_in_days',
        'days_since_cleaning',
        'hour',
        'day_of_year'
    ]
    target = 'energy_loss_kw' # Our new target!

    X = df[features]
    y = df[target]
    print(f"Features: {features}")
    print(f"Target: {target}")

    # Use a standard train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Initialize and Train the Model
    model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1, max_depth=10)
    print("Training model to predict energy loss...")
    model.fit(X_train, y_train)
    print("Model training complete.")

    # Evaluate the Model
    # For loss prediction, Mean Absolute Error is more intuitive than R^2
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    print(f"Model evaluation complete. Mean Absolute Error: {mae:.4f} kW")
    print(f"(This means on average, the prediction is off by {mae*1000:.1f} Watts)")

    # Save the new model
    output_dir = os.path.dirname(model_output_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    joblib.dump(model, model_output_path)
    print(f"Loss prediction model saved to: {os.path.abspath(model_output_path)}")

if __name__ == '__main__':
    script_dir = os.path.dirname(__file__)
    data_file_path = os.path.join(script_dir, '..', '..', 'data', 'historical_loss_data.csv')
    model_save_path = os.path.join(script_dir, '..', 'saved_model', 'loss_prediction_model.pkl')
    train_loss_model(data_path=data_file_path, model_output_path=model_save_path)
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import joblib
import os
import shutil
import hashlib
import json
import datetime
import subprocess
import traceback
import sys
# When executed as a script, ensure the project root is on sys.path so we can import utils
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
import importlib.util
spec_path = os.path.join(os.path.dirname(__file__), '..', 'utils', 'metadata.py')
spec_path = os.path.abspath(spec_path)
spec = importlib.util.spec_from_file_location('metadata_utils', spec_path)
meta_utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(meta_utils)

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
    # Remove nighttime rows where ideal_power_kw is very small (not informative)
    if 'ideal_power_kw' in df.columns:
        mask_day = df['ideal_power_kw'] > 0.01
        X = X[mask_day]
        y = y[mask_day]

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

    # Show feature importances for debugging
    try:
        importances = model.feature_importances_
        for f, imp in sorted(zip(features, importances), key=lambda x: -x[1]):
            print(f"Feature: {f}, Importance: {imp:.4f}")
    except Exception:
        pass

    # Save the new model (but first back up existing model if present)
    output_dir = os.path.dirname(model_output_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    # Backup existing model instead of deleting
    try:
        if os.path.exists(model_output_path):
            backup_dir = os.path.join(output_dir, 'backup')
            os.makedirs(backup_dir, exist_ok=True)
            timestamp = datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
            backup_name = f"loss_prediction_model_{timestamp}.pkl"
            backup_path = os.path.join(backup_dir, backup_name)
            shutil.move(model_output_path, backup_path)
            print('Moved old model to backup:', os.path.abspath(backup_path))
    except Exception as e:
        print('Warning: could not back up old model file:', e)

    # Save current model
    joblib.dump(model, model_output_path)
    print(f"Loss prediction model saved to: {os.path.abspath(model_output_path)}")

    # Create metadata for this model and write alongside the model
    try:
        metadata = {}
        metadata['saved_at_utc'] = datetime.datetime.utcnow().isoformat() + 'Z'
        metadata['model_file'] = os.path.abspath(model_output_path)
        metadata['features'] = features
        metadata['mae'] = float(mae)

        # dataset checksum (sha256)
        try:
            h = hashlib.sha256()
            with open(data_path, 'rb') as fh:
                for chunk in iter(lambda: fh.read(8192), b''):
                    h.update(chunk)
            metadata['dataset_sha256'] = h.hexdigest()
            metadata['dataset_path'] = os.path.abspath(data_path)
        except Exception as e:
            metadata['dataset_sha256'] = None
            metadata['dataset_path'] = os.path.abspath(data_path) if os.path.exists(data_path) else data_path
            print('Warning: Could not compute dataset checksum:', e)

        # git commit sha (short) if available
        try:
            git_sha = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=os.getcwd()).decode().strip()
            metadata['git_commit_short'] = git_sha
        except Exception:
            metadata['git_commit_short'] = None

        metadata_path = os.path.join(output_dir, 'model_metadata.json')
        history_path = os.path.join(output_dir, 'metadata_history.jsonl')
        lock_path = os.path.join(output_dir, 'metadata.lock')
        try:
            meta_utils.write_metadata_with_lock(metadata, metadata_path, history_path, lock_path)
            print('Wrote model metadata to:', os.path.abspath(metadata_path))
            print('Appended metadata to history:', os.path.abspath(history_path))
        except Exception as e:
            print('Warning: failed to write metadata or history:', e)
            traceback.print_exc()
    except Exception:
        print('Warning: failed to write model metadata')
        traceback.print_exc()

if __name__ == '__main__':
    script_dir = os.path.dirname(__file__)
    data_file_path = os.path.join(script_dir, '..', '..', 'data', 'historical_loss_data.csv')
    model_save_path = os.path.join(script_dir, '..', 'saved_model', 'loss_prediction_model.pkl')
    train_loss_model(data_path=data_file_path, model_output_path=model_save_path)
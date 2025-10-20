from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd  # Make sure pandas is imported
import datetime
import requests
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = Flask(__name__)
CORS(app)

# --- Configuration ---
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')
OPENWEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather"
MODERATE_LOSS_THRESHOLD_KW = 0.4  # Noticeable loss, suggest monitoring/planning
HIGH_LOSS_THRESHOLD_KW = 0.8      # Significant loss, recommend action
CRITICAL_LOSS_THRESHOLD_KW = 1.2  # Severe loss, urge immediate action
HIGH_TEMP_THRESHOLD_CELSIUS = 35
PANEL_AGE_THRESHOLD_YEARS = 10
HIGH_CLOUD_COVER_THRESHOLD = 75

# --- Feature Names (to silence the warning) ---
FEATURE_NAMES = [
    'temperature_celsius',
    'cloud_cover_percentage',
    'panel_age_in_days',
    'days_since_cleaning',
    'hour',
    'day_of_year'
]

# --- Model Loading ---
script_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(script_dir, 'ml_training', 'saved_model', 'loss_prediction_model.pkl')
try:
    model = joblib.load(model_path)
    print(f"Model loaded successfully from {model_path}")
except FileNotFoundError:
    print(f"Error: Model file not found at '{model_path}'")
    model = None

# --- Helper Functions ---
def get_live_weather(lat, lon):
    """Fetches live weather data from OpenWeatherMap."""
    if not OPENWEATHER_API_KEY or OPENWEATHER_API_KEY == 'YOUR_API_KEY_HERE':
        print("Warning: OpenWeatherMap API key not set or invalid. Using dummy data.")
        return {'temperature_celsius': 25.0, 'cloud_cover_percentage': 20.0, 'error': None}
    params = {'lat': lat, 'lon': lon, 'appid': OPENWEATHER_API_KEY, 'units': 'metric'}
    try:
        response = requests.get(OPENWEATHER_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        return {
            'temperature_celsius': data['main']['temp'],
            'cloud_cover_percentage': data['clouds']['all'],
            'error': None
        }
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return {'temperature_celsius': None, 'cloud_cover_percentage': None, 'error': str(e)}

def generate_recommendation(predicted_loss_kw, weather, panel_age_in_days, days_since_cleaning):
    """Generates a highly specific, tiered recommendation based on live data."""
    recommendations = []
    action_required = False

    # 1. Tiered recommendation for soiling/degradation based on predicted loss
    if predicted_loss_kw > CRITICAL_LOSS_THRESHOLD_KW:
        recommendations.append(
            f"CRITICAL: Immediate action required. Energy loss is at a severe {predicted_loss_kw:.2f} kW, "
            f"likely from heavy soiling over the past {days_since_cleaning} days. "
            "Action: Schedule immediate professional cleaning and inspection."
        )
        action_required = True
    elif predicted_loss_kw > HIGH_LOSS_THRESHOLD_KW:
        recommendations.append(
            f"High Priority: Energy loss has reached {predicted_loss_kw:.2f} kW. "
            f"Efficiency is significantly impacted by soiling. "
            "Action: Schedule panel cleaning soon to restore performance."
        )
        action_required = True
    elif predicted_loss_kw > MODERATE_LOSS_THRESHOLD_KW:
        recommendations.append(
            f"Moderate Priority: A noticeable energy loss of {predicted_loss_kw:.2f} kW is detected. "
            f"This is likely due to accumulating dust. "
            "Action: Plan to clean panels in the near future to prevent further loss."
        )
        action_required = True

    # 2. Recommendation based on high temperature
    if weather['temperature_celsius'] > HIGH_TEMP_THRESHOLD_CELSIUS:
        recommendations.append(
            f"Weather Factor: High temperature ({weather['temperature_celsius']:.1f}°C) is reducing panel efficiency. "
            "Solution: Ensure panels have adequate ventilation to dissipate heat."
        )

    # 3. Recommendation based on heavy cloud cover
    if weather['cloud_cover_percentage'] > HIGH_CLOUD_COVER_THRESHOLD:
        recommendations.append(
            f"Weather Factor: Heavy cloud cover ({weather['cloud_cover_percentage']}%) is limiting power generation. "
            "This is temporary and no action is needed."
        )

    # 4. Recommendation based on panel age
    if panel_age_in_days > (PANEL_AGE_THRESHOLD_YEARS * 365):
        recommendations.append(
            f"Long-Term: Panels are over {PANEL_AGE_THRESHOLD_YEARS} years old. "
            "Consider a professional inspection for age-related degradation."
        )

    # Default message if no specific issues are found
    if not recommendations:
        return "System performing within expected parameters. No immediate action required.", False

    return " ".join(recommendations), action_required

# --- API Endpoints ---
@app.route('/api/live_status', methods=['GET'])
def live_status():
    if not model:
        return jsonify({"error": "Model is not loaded on the server."}), 500
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
        panel_age_in_days = int(request.args.get('panel_age_in_days'))
        days_since_cleaning = int(request.args.get('days_since_cleaning'))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid or missing query parameters."}), 400

    weather = get_live_weather(lat, lon)
    if weather['error']:
        return jsonify({"error": f"Failed to fetch weather data: {weather['error']}"}), 500

    now = datetime.datetime.now(datetime.UTC)  # Use timezone-aware datetime
    hour = now.hour
    day_of_year = now.timetuple().tm_yday

    # Create a pandas DataFrame with feature names
    features_df = pd.DataFrame([[
        weather['temperature_celsius'],
        weather['cloud_cover_percentage'],
        panel_age_in_days,
        days_since_cleaning,
        hour,
        day_of_year
    ]], columns=FEATURE_NAMES)

    predicted_loss_kw = model.predict(features_df)[0]
    recommendation_message, action_required = generate_recommendation(predicted_loss_kw, weather, panel_age_in_days, days_since_cleaning)

    return jsonify({
        "live_weather": weather,
        "predicted_loss_kw": round(predicted_loss_kw, 4),
        "action_required": action_required,
        "recommendation_message": recommendation_message,
        "timestamp": now.isoformat()
    })

@app.route('/api/history', methods=['GET'])
def get_history():
    if not model:
        return jsonify({"error": "Model is not loaded on the server."}), 500
    try:
        panel_age_in_days = int(request.args.get('panel_age_in_days'))
        days_since_cleaning = int(request.args.get('days_since_cleaning'))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid or missing query parameters."}), 400

    now = datetime.datetime.now(datetime.UTC)
    history = []
    for i in range(24, 0, -1):
        timestamp = now - datetime.timedelta(hours=i)
        hour = timestamp.hour
        day_of_year = timestamp.timetuple().tm_yday
        temp_fluctuation = 8 * np.sin((hour - 8) * (np.pi / 12))
        sim_temp = 22 + temp_fluctuation
        sim_clouds = max(0, min(100, 50 - 30 * np.sin((hour - 8) * (np.pi / 12))))

        if 6 <= hour <= 18:
            features_df = pd.DataFrame([[sim_temp, sim_clouds, panel_age_in_days, days_since_cleaning, hour, day_of_year]], columns=FEATURE_NAMES)
            predicted_loss = model.predict(features_df)[0]
        else:
            predicted_loss = 0.0

        history.append({
            "timestamp": timestamp.isoformat(),
            "temperature_celsius": round(sim_temp, 1),
            "cloud_cover_percentage": int(sim_clouds),
            "predicted_loss_kw": round(predicted_loss, 4)
        })
    return jsonify(history)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
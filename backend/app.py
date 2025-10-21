from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd
import datetime
import requests
import os
from dotenv import load_dotenv

load_dotenv()


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Enable CORS for all domains on all routes
    CORS(app)

    # --- Configuration ---
    OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')
    OPENWEATHER_CURRENT_API_URL = "https://api.openweathermap.org/data/2.5/weather"
    MODERATE_LOSS_THRESHOLD_KW = 0.4
    HIGH_LOSS_THRESHOLD_KW = 0.8
    CRITICAL_LOSS_THRESHOLD_KW = 1.2
    HIGH_TEMP_THRESHOLD_CELSIUS = 35
    PANEL_AGE_THRESHOLD_YEARS = 10
    HIGH_CLOUD_COVER_THRESHOLD = 75
    # Dust accumulation heuristic
    DUST_LOSS_PER_DAY_PCT = 0.4  # ~0.4% loss per day without cleaning
    MAX_DUST_LOSS_PCT = 20.0     # cap dust-related loss at 20%

    # --- Feature Names (Must match the model's training) ---
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
    model_path = os.path.join(
        script_dir, 'ml_training', 'saved_model', 'loss_prediction_model.pkl')
    try:
        model = joblib.load(model_path)
        print(f"Model loaded successfully from {model_path}")
    except FileNotFoundError:
        print(f"Error: Model file not found at '{model_path}'")
        model = None

    # --- Helper Functions ---
    def get_live_weather(lat, lon):
        """Fetches live weather data from OpenWeatherMap Current Weather API (free tier)."""
        if not OPENWEATHER_API_KEY or OPENWEATHER_API_KEY == 'YOUR_API_KEY_HERE':
            print("Warning: OpenWeatherMap API key not set or invalid. Using dummy data.")
            return {
                'temperature_celsius': 25.0,
                'cloud_cover_percentage': 20.0,
                'uv_index': 5.0,
                'error': None
            }

        params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }

        try:
            response = requests.get(OPENWEATHER_CURRENT_API_URL, params=params)
            response.raise_for_status()
            data = response.json()

            # Calculate approximate UV index based on time of day
            # This is a rough estimate since free API doesn't provide UV index
            now = datetime.datetime.now()
            hour = now.hour
            # UV peaks around noon, zero at night
            if 6 <= hour <= 18:
                uv_index = max(0, 8 * np.cos((hour - 13) * (np.pi / 12)))
            else:
                uv_index = 0

            return {
                'temperature_celsius': data['main']['temp'],
                'cloud_cover_percentage': data['clouds']['all'],
                'uv_index': round(uv_index, 1),
                'error': None
            }
        except requests.exceptions.RequestException as e:
            print(f"Error fetching weather data: {e}")
            # Return dummy data as fallback
            return {
                'temperature_celsius': 25.0,
                'cloud_cover_percentage': 20.0,
                'uv_index': 5.0,
                'error': None  # Don't expose error to frontend, just use fallback
            }

    def seasonal_optimal_tilt(latitude_deg: float, month: int) -> float:
        """Compute a simple seasonal optimal tilt based on latitude and month.
        Summer (Apr–Sep): latitude - 15; Winter (Oct–Mar): latitude + 15. Clamped to [0, 90].
        """
        if month >= 4 and month <= 9:
            optimal = abs(latitude_deg) - 15
        else:
            optimal = abs(latitude_deg) + 15
        return max(0.0, min(90.0, optimal))

    def compute_tilt_penalty(tilt_angle: float, optimal_tilt: float) -> float:
        """Approximate loss percentage due to tilt deviation.
        Uses a simple heuristic: ~0.6% per degree of deviation, capped at 25%.
        """
        delta = abs(tilt_angle - optimal_tilt)
        return min(25.0, 0.6 * delta)

    def generate_recommendation(predicted_loss_kw, weather, panel_age_in_days, days_since_cleaning, tilt_penalty_pct: float = 0.0, tilt_angle: float | None = None, optimal_tilt: float | None = None):
        """Generates a highly specific, tiered recommendation based on live data."""
        recommendations = []
        action_required = False

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

        if weather.get('temperature_celsius') and weather['temperature_celsius'] > HIGH_TEMP_THRESHOLD_CELSIUS:
            recommendations.append(
                f"Weather Factor: High temperature ({weather['temperature_celsius']:.1f}°C) is reducing panel efficiency. "
                "Solution: Ensure panels have adequate ventilation to dissipate heat."
            )

        if weather.get('cloud_cover_percentage') and weather['cloud_cover_percentage'] > HIGH_CLOUD_COVER_THRESHOLD:
            recommendations.append(
                f"Weather Factor: Heavy cloud cover ({weather['cloud_cover_percentage']}%) is limiting power generation. "
                "This is temporary and no action is needed."
            )

        if panel_age_in_days > (PANEL_AGE_THRESHOLD_YEARS * 365):
            recommendations.append(
                f"Long-Term: Panels are over {PANEL_AGE_THRESHOLD_YEARS} years old. "
                "Consider a professional inspection for age-related degradation."
            )

        # Orientation/tilt recommendation if penalty is notable
        if tilt_penalty_pct is not None and tilt_penalty_pct >= 5.0 and tilt_angle is not None and optimal_tilt is not None:
            recommendations.append(
                f"Orientation Factor: Current tilt ({tilt_angle:.0f}°) deviates from seasonal optimal ({optimal_tilt:.0f}°), causing ~{tilt_penalty_pct:.1f}% potential loss. "
                "Consider adjusting tilt for improved yield."
            )

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
            num_panels = int(request.args.get('num_panels', 1))
            ideal_panel_generation_kw = float(
                request.args.get('ideal_panel_generation_kw', 0.45))
            tilt_angle = float(request.args.get('tilt_angle', 25))
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid or missing query parameters."}), 400

        weather = get_live_weather(lat, lon)
        if weather['error']:
            return jsonify({"error": f"Failed to fetch weather data: {weather['error']}"}), 500

        now = datetime.datetime.now(datetime.UTC)
        hour = now.hour
        day_of_year = now.timetuple().tm_yday
        month = now.month

        features_df = pd.DataFrame([[
            weather['temperature_celsius'],
            weather['cloud_cover_percentage'],
            panel_age_in_days,
            days_since_cleaning,
            hour,
            day_of_year
        ]], columns=FEATURE_NAMES)

        predicted_loss_per_panel_kw = model.predict(features_df)[0]
        total_predicted_loss_kw = predicted_loss_per_panel_kw * num_panels

        total_ideal_generation_kw = ideal_panel_generation_kw * num_panels

        # Tilt/Orientation loss computation
        optimal_tilt = seasonal_optimal_tilt(lat, month)
        tilt_penalty_pct = compute_tilt_penalty(
            tilt_angle, optimal_tilt)  # percentage
        tilt_loss_kw = (tilt_penalty_pct / 100.0) * total_ideal_generation_kw

        # Combine ML-predicted loss and tilt loss
        combined_total_loss_kw = total_predicted_loss_kw + tilt_loss_kw
        actual_generation_kw = max(
            0, total_ideal_generation_kw - combined_total_loss_kw)

        energy_depreciation_percentage = 0
        if total_ideal_generation_kw > 0:
            energy_depreciation_percentage = (
                combined_total_loss_kw / total_ideal_generation_kw) * 100

        recommendation_message, action_required = generate_recommendation(
            combined_total_loss_kw,
            weather,
            panel_age_in_days,
            days_since_cleaning,
            tilt_penalty_pct=tilt_penalty_pct,
            tilt_angle=tilt_angle,
            optimal_tilt=optimal_tilt,
        )

        # Estimate daily financial loss (assuming ₹8 per kWh)
        estimated_daily_financial_loss = combined_total_loss_kw * 24 * 8

        return jsonify({
            "live_weather": {
                "temperature_celsius": weather['temperature_celsius'],
                "cloud_cover_percentage": weather['cloud_cover_percentage'],
                # Alias for compatibility
                "cloud_cover": weather['cloud_cover_percentage'],
                "uv_index": weather['uv_index']
            },
            "live_status": {
                "predicted_hourly_loss_kw": round(predicted_loss_per_panel_kw, 4),
                "total_system_loss_kw": round(combined_total_loss_kw, 4),
                "actual_generation_kw": round(actual_generation_kw, 4),
                "energy_depreciation_percentage": round(energy_depreciation_percentage, 2),
                "dust_level_days": days_since_cleaning,
                "tilt_angle_deg": round(tilt_angle, 1),
                "optimal_tilt_angle_deg": round(optimal_tilt, 1),
                "tilt_penalty_percentage": round(tilt_penalty_pct, 2),
                "tilt_loss_kw": round(tilt_loss_kw, 4),
                "action_required": action_required,
                "recommendation_message": recommendation_message,
                "estimated_daily_financial_loss": round(estimated_daily_financial_loss, 2)
            },
            "timestamp": now.isoformat()
        })

    @app.route('/api/history', methods=['GET'])
    def get_history():
        if not model:
            return jsonify({"error": "Model is not loaded on the server."}), 500
        try:
            panel_age_in_days = int(request.args.get('panel_age_in_days'))
            days_since_cleaning = int(request.args.get('days_since_cleaning'))
            num_panels = int(request.args.get('num_panels', 1))
            ideal_panel_generation_kw = float(
                request.args.get('ideal_panel_generation_kw', 0.45))
            tilt_angle = float(request.args.get('tilt_angle', 25))
            # Optional lat/lon for seasonal optimal computation; default to Bhubaneswar if not provided
            lat = float(request.args.get('lat', 20.2961))
            lon = float(request.args.get('lon', 85.8245))
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid or missing query parameters."}), 400

        now = datetime.datetime.now(datetime.UTC)
        history = []
        for i in range(24, 0, -1):
            timestamp = now - datetime.timedelta(hours=i)
            hour = timestamp.hour
            day_of_year = timestamp.timetuple().tm_yday
            month = timestamp.month

            temp_fluctuation = 8 * np.sin((hour - 8) * (np.pi / 12))
            sim_temp = 22 + temp_fluctuation
            sim_clouds = max(
                0, min(100, 50 - 30 * np.sin((hour - 8) * (np.pi / 12))))
            sim_uv = max(0, 8 * np.cos((hour - 13) * (np.pi / 12)))

            predicted_loss_per_panel = 0.0
            if 6 <= hour <= 18:
                features_df = pd.DataFrame(
                    [[sim_temp, sim_clouds, panel_age_in_days, days_since_cleaning, hour, day_of_year]], columns=FEATURE_NAMES)
                predicted_loss_per_panel = model.predict(features_df)[0]

            total_predicted_loss = predicted_loss_per_panel * num_panels
            total_ideal_generation = ideal_panel_generation_kw * num_panels

            # Tilt loss for this hour (apply same seasonal heuristic)
            optimal_tilt = seasonal_optimal_tilt(lat, month)
            tilt_penalty_pct = compute_tilt_penalty(tilt_angle, optimal_tilt)
            tilt_loss_kw = (tilt_penalty_pct / 100.0) * total_ideal_generation

            combined_total_loss_kw = total_predicted_loss + tilt_loss_kw

            energy_depreciation_percentage = 0
            if total_ideal_generation > 0 and 6 <= hour <= 18:
                energy_depreciation_percentage = (
                    combined_total_loss_kw / total_ideal_generation) * 100

            history.append({
                "timestamp": timestamp.isoformat(),
                "temperature_celsius": round(sim_temp, 1),
                "cloud_cover_percentage": int(sim_clouds),
                "uv_index": round(sim_uv, 1),
                "dust_level_days": days_since_cleaning,
                "predicted_loss_kw": round(combined_total_loss_kw, 4),
                "energy_depreciation_percentage": round(energy_depreciation_percentage, 2),
                "tilt_angle_deg": round(tilt_angle, 1),
                "optimal_tilt_angle_deg": round(optimal_tilt, 1),
                "tilt_penalty_percentage": round(tilt_penalty_pct, 2),
                "tilt_loss_kw": round(tilt_loss_kw, 4),
            })
        return jsonify(history)

    @app.route('/api/dust_trend', methods=['GET'])
    def dust_trend():
        """Returns date-wise dust accumulation trend and its estimated impact.
        Query params: days_since_cleaning, num_days (default 14), num_panels, ideal_panel_generation_kw
        """
        try:
            base_days = int(request.args.get('days_since_cleaning', 0))
            num_days = int(request.args.get('num_days', 14))
            num_panels = int(request.args.get('num_panels', 1))
            ideal_panel_generation_kw = float(
                request.args.get('ideal_panel_generation_kw', 0.45))
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid or missing query parameters."}), 400

        now = datetime.datetime.now(datetime.UTC)
        total_ideal_generation_kw = num_panels * ideal_panel_generation_kw
        trend = []
        for i in range(num_days - 1, -1, -1):
            day_dt = now - datetime.timedelta(days=i)
            d = base_days + (num_days - 1 - i)
            dust_loss_pct = min(MAX_DUST_LOSS_PCT, DUST_LOSS_PER_DAY_PCT * d)
            dust_loss_kw = (dust_loss_pct / 100.0) * total_ideal_generation_kw
            trend.append({
                "date": day_dt.date().isoformat(),
                "dust_level_days": d,
                "estimated_dust_loss_pct": round(dust_loss_pct, 2),
                "estimated_dust_loss_kw": round(dust_loss_kw, 4)
            })

        return jsonify(trend)

    @app.route('/api/log_reading', methods=['POST'])
    def log_reading():
        """Append a reading to a CSV log for continual learning."""
        data = request.get_json(silent=True) or {}
        required_fields = [
            'timestamp', 'lat', 'lon', 'panel_age_in_days', 'days_since_cleaning',
            'temperature_celsius', 'cloud_cover_percentage', 'uv_index',
            'predicted_hourly_loss_kw', 'total_system_loss_kw', 'actual_generation_kw',
            'energy_depreciation_percentage'
        ]
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields in payload."}), 400

        logs_dir = os.path.join(script_dir, 'data')
        os.makedirs(logs_dir, exist_ok=True)
        logs_path = os.path.join(logs_dir, 'readings_log.csv')

        df_row = pd.DataFrame([data])
        header = not os.path.exists(logs_path)
        try:
            df_row.to_csv(logs_path, mode='a', header=header, index=False)
        except Exception as e:
            return jsonify({"error": f"Failed to write logs: {e}"}), 500

        return jsonify({"status": "ok"})


    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({"status": "ok"})

    @app.route('/api/logs', methods=['GET'])
    def get_logs():
        """Return logged readings as JSON (for quick inspection/download)."""
        logs_path = os.path.join(script_dir, 'data', 'readings_log.csv')
        if not os.path.exists(logs_path):
            return jsonify([])
        try:
            df = pd.read_csv(logs_path)
            return jsonify(df.to_dict(orient='records'))
        except Exception as e:
            return jsonify({"error": f"Failed to read logs: {e}"}), 500

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5001)

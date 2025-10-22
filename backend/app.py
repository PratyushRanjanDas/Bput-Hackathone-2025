from flask import Flask, request, jsonify
from flask_cors import CORS
import onnxruntime as ort
import numpy as np
import pandas as pd
import datetime
import requests
import os
from dotenv import load_dotenv
import json
from pywebpush import webpush, WebPushException

load_dotenv()


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Enable CORS for all domains on all routes (explicit to ensure headers on errors)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # --- Configuration ---
    OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')
    OPENWEATHER_CURRENT_API_URL = "https://api.openweathermap.org/data/2.5/weather"
    # Prefer One Call for UV index (current.uvi). Keep legacy current weather as fallback.
    OPENWEATHER_ONECALL_API_URL = "https://api.openweathermap.org/data/2.5/onecall"
    MODERATE_LOSS_THRESHOLD_KW = 0.4
    HIGH_LOSS_THRESHOLD_KW = 0.8
    CRITICAL_LOSS_THRESHOLD_KW = 1.2
    # Percentage thresholds (recommended for kWh/d frontend)
    MODERATE_LOSS_THRESHOLD_PCT = 5.0   # percent
    HIGH_LOSS_THRESHOLD_PCT = 10.0
    CRITICAL_LOSS_THRESHOLD_PCT = 20.0
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
        script_dir, 'ml_training', 'saved_model', 'loss_prediction_model.onnx')
    try:
        ort_session = ort.InferenceSession(model_path)
        print(f"ONNX model loaded successfully from {model_path}")
    except Exception as e:
        print(f"Error loading ONNX model: {e}")
        ort_session = None

    # --- Helper Functions ---
    def get_live_weather(lat, lon):
        """Fetches live weather data. Prefer OpenWeather One Call (to get `uvi`) and
        fall back to Current Weather + diurnal heuristic when necessary.
        Returns a dict with temperature_celsius, cloud_cover_percentage, uv_index, error.
        """
        if not OPENWEATHER_API_KEY or OPENWEATHER_API_KEY == 'YOUR_API_KEY_HERE':
            print("Warning: OpenWeatherMap API key not set or invalid. Using dummy data.")
            return {
                'temperature_celsius': 25.0,
                'cloud_cover_percentage': 20.0,
                'uv_index': 5.0,
                'error': None
            }

        # First try the One Call API which provides current.uvi
        onecall_params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric',
            'exclude': 'minutely,daily,alerts'
        }

        try:
            oc_resp = requests.get(OPENWEATHER_ONECALL_API_URL, params=onecall_params, timeout=5)
            oc_resp.raise_for_status()
            oc_data = oc_resp.json()

            current = oc_data.get('current', {})
            temp = current.get('temp')
            clouds = current.get('clouds')
            uvi = current.get('uvi')

            # If the One Call response has the fields we need, return them.
            if temp is not None and clouds is not None:
                # If uvi missing, fall back to diurnal heuristic below
                if uvi is None:
                    now = datetime.datetime.now()
                    hour = now.hour
                    if 6 <= hour <= 18:
                        uvi = max(0, 8 * np.cos((hour - 13) * (np.pi / 12)))
                    else:
                        uvi = 0

                return {
                    'temperature_celsius': temp,
                    'cloud_cover_percentage': clouds,
                    'uv_index': round(uvi, 1),
                    'error': None
                }
        except requests.exceptions.RequestException:
            # Ignore and fall back to Current Weather API + heuristic below
            pass

        # Fall back to the Current Weather API (less likely to include uvi)
        params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }

        try:
            response = requests.get(OPENWEATHER_CURRENT_API_URL, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()

            # Calculate approximate UV index based on time of day when not provided by API
            now = datetime.datetime.now()
            hour = now.hour
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

    def generate_recommendation(predicted_loss_kw, weather, panel_age_in_days, days_since_cleaning, tilt_penalty_pct: float = 0.0, tilt_angle: float | None = None, optimal_tilt: float | None = None, energy_depreciation_pct: float | None = None):
        """Generates a highly specific, tiered recommendation based on live data."""
        recommendations = []
        action_required = False
        # Prefer using percentage-based thresholds when available (safer for kWh/d frontend)
        if energy_depreciation_pct is not None:
            if energy_depreciation_pct > CRITICAL_LOSS_THRESHOLD_PCT:
                recommendations.append(
                    f"CRITICAL: Immediate action required. Estimated energy depreciation is {energy_depreciation_pct:.1f}%, "
                    f"likely from heavy soiling over the past {days_since_cleaning} days. Action: Schedule immediate professional cleaning and inspection."
                )
                action_required = True
            elif energy_depreciation_pct > HIGH_LOSS_THRESHOLD_PCT:
                recommendations.append(
                    f"High Priority: Energy depreciation is {energy_depreciation_pct:.1f}%. Efficiency is significantly impacted; consider cleaning soon."
                )
                action_required = True
            elif energy_depreciation_pct > MODERATE_LOSS_THRESHOLD_PCT:
                recommendations.append(
                    f"Moderate Priority: Estimated energy depreciation {energy_depreciation_pct:.1f}% indicates accumulating dust. Plan to clean panels soon."
                )
                action_required = True
        else:
            # Fallback to original kW thresholds
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
    # In-memory subscription store (for demo/testing). Replace with DB for production.
    push_subscriptions = []

    VAPID_PUBLIC_KEY = os.getenv('VAPID_PUBLIC', '')
    VAPID_PRIVATE_KEY = os.getenv('VAPID_PRIVATE', '')
    VAPID_CLAIMS = { 'sub': os.getenv('VAPID_SUB', 'mailto:admin@example.com') }

    @app.route('/api/vapid_public', methods=['GET'])
    def vapid_public():
        return jsonify({ 'publicKey': VAPID_PUBLIC_KEY })

    @app.route('/api/save-subscription', methods=['POST'])
    def save_subscription():
        try:
            sub = request.get_json(force=True)
            if not sub:
                return jsonify({'error':'No subscription provided'}), 400
            # naive dedupe
            if sub not in push_subscriptions:
                push_subscriptions.append(sub)
            return jsonify({'status':'ok'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/trigger-push', methods=['POST'])
    def trigger_push():
        payload = request.get_json(silent=True) or {}
        title = payload.get('title', 'Solar Panel Optimizer')
        body = payload.get('body', 'Energy loss exceeds threshold')
        sent = []
        for sub in list(push_subscriptions):
            try:
                webpush(
                    subscription_info=sub,
                    data=json.dumps({'title': title, 'body': body, 'url': payload.get('url','/')}),
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims=VAPID_CLAIMS,
                )
                sent.append({'status':'ok'})
            except WebPushException as ex:
                # If subscription is no longer valid, remove it
                sent.append({'status':'fail','error':str(ex)})
        return jsonify({'results': sent})
    @app.route('/api/live_status', methods=['GET'])
    def live_status():
        # Clean, consistent implementation for live_status
        if not ort_session:
            return jsonify({"error": "ONNX model is not loaded on the server."}), 500

        # Parse query params
        try:
            lat = float(request.args.get('lat', 20.2961))
            lon = float(request.args.get('lon', 85.8245))
            panel_age_in_days = int(request.args.get('panel_age_in_days', 365))
            days_since_cleaning = int(request.args.get('days_since_cleaning', 30))
            num_panels = int(request.args.get('num_panels', 1))
            ideal_panel_generation_kw = float(request.args.get('ideal_panel_generation_kw', 0.45))
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

        # Prepare feature vector for ONNX model (match FEATURE_NAMES)
        input_features = np.array([[
            weather['temperature_celsius'],
            weather['cloud_cover_percentage'],
            panel_age_in_days,
            days_since_cleaning,
            hour,
            day_of_year
        ]], dtype=np.float32)
        try:
            ort_inputs = {ort_session.get_inputs()[0].name: input_features}
            raw_pred_system_kw = float(ort_session.run(None, ort_inputs)[0][0][0])
        except Exception as e:
            app.logger.exception('ONNX model prediction failed')
            return jsonify({"error": "ONNX model prediction error"}), 500
        # Determine allowed range: give a small buffer but prevent implausible spikes
        ideal_total_generation_kw = ideal_panel_generation_kw * num_panels
        max_allowed_system = max(ideal_total_generation_kw * 2.0, 50.0)  # allow up to 2x ideal or 50 kW hard cap
        if raw_pred_system_kw < 0 or raw_pred_system_kw > max_allowed_system:
            app.logger.warning('Clipping system-level model prediction: original=%s kW, max_allowed=%s kW, hour=%s', raw_pred_system_kw, max_allowed_system, hour)
        predicted_system_loss_kw = max(0.0, min(raw_pred_system_kw, max_allowed_system))

        # Per-panel instantaneous loss
        predicted_loss_per_panel_kw = predicted_system_loss_kw / max(1, int(num_panels))

        # Monotonicity/soiling check (predict with increased days_since_cleaning)
        try:
            delta_days = int(request.args.get('monotonicity_check_days', 7))
        except Exception:
            delta_days = 7
        input_features_more = np.array([[
            weather['temperature_celsius'],
            weather['cloud_cover_percentage'],
            panel_age_in_days,
            days_since_cleaning + delta_days,
            hour,
            day_of_year
        ]], dtype=np.float32)
        try:
            ort_inputs_more = {ort_session.get_inputs()[0].name: input_features_more}
            predicted_more_per_panel = float(ort_session.run(None, ort_inputs_more)[0][0][0])
        except Exception:
            predicted_more_per_panel = predicted_loss_per_panel_kw

        soiling_explanation_ok = (predicted_more_per_panel - predicted_loss_per_panel_kw) > 0.0001
        reported_soiling_loss_kw = max(0.0, (predicted_more_per_panel - predicted_loss_per_panel_kw) * num_panels)

        # System totals
        total_predicted_loss_kw = predicted_system_loss_kw
        total_ideal_generation_kw = ideal_panel_generation_kw * num_panels

        # Tilt/Orientation loss computation
        optimal_tilt = seasonal_optimal_tilt(lat, month)
        tilt_penalty_pct = compute_tilt_penalty(tilt_angle, optimal_tilt)
        tilt_loss_kw = (tilt_penalty_pct / 100.0) * total_ideal_generation_kw

        combined_total_loss_kw = total_predicted_loss_kw + tilt_loss_kw
        actual_generation_kw = max(0, total_ideal_generation_kw - combined_total_loss_kw)

        # Percent and daily conversions
        energy_depreciation_percentage = 0.0
        if total_ideal_generation_kw > 0:
            energy_depreciation_percentage = (combined_total_loss_kw / total_ideal_generation_kw) * 100.0
            energy_depreciation_percentage = max(0.0, min(100.0, energy_depreciation_percentage))

        predicted_daily_loss_kwh_per_panel = predicted_loss_per_panel_kw * 24.0
        total_system_daily_loss_kwh = combined_total_loss_kw * 24.0

        # Cap daily loss at system ideal
        ideal_total_daily_kwh = total_ideal_generation_kw * 24.0
        if total_system_daily_loss_kwh > ideal_total_daily_kwh:
            app.logger.warning('Capping total_system_daily_loss_kwh: computed=%s ideal=%s', total_system_daily_loss_kwh, ideal_total_daily_kwh)
            total_system_daily_loss_kwh = ideal_total_daily_kwh

        # Always compute percentage and per-panel from capped daily loss
        if ideal_total_daily_kwh > 0:
            energy_depreciation_percentage = (total_system_daily_loss_kwh / ideal_total_daily_kwh) * 100.0
            energy_depreciation_percentage = max(0.0, min(100.0, energy_depreciation_percentage))
        else:
            energy_depreciation_percentage = 0.0

        predicted_daily_loss_kwh_per_panel = total_system_daily_loss_kwh / max(1, int(num_panels))
        combined_total_loss_kw = total_system_daily_loss_kwh / 24.0
        actual_generation_kw = max(0.0, total_ideal_generation_kw - combined_total_loss_kw)

        estimated_daily_financial_loss = total_system_daily_loss_kwh * 8.0

        recommendation_message, action_required = generate_recommendation(
            combined_total_loss_kw,
            weather,
            panel_age_in_days,
            days_since_cleaning,
            tilt_penalty_pct=tilt_penalty_pct,
            tilt_angle=tilt_angle,
            optimal_tilt=optimal_tilt,
            energy_depreciation_pct=energy_depreciation_percentage,
        )

        return jsonify({
            "live_weather": {
                "temperature_celsius": weather['temperature_celsius'],
                "cloud_cover_percentage": weather['cloud_cover_percentage'],
                "cloud_cover": weather['cloud_cover_percentage'],
                "uv_index": weather['uv_index']
            },
            "live_status": {
                "predicted_system_loss_kw": round(predicted_system_loss_kw, 4),
                "predicted_daily_loss_kwh_per_panel": round(predicted_daily_loss_kwh_per_panel, 4),
                "total_system_loss_kw": round(combined_total_loss_kw, 4),
                "total_system_daily_loss_kwh": round(total_system_daily_loss_kwh, 4),
                "num_panels": int(num_panels),
                "actual_generation_kw": round(actual_generation_kw, 4),
                "energy_depreciation_percentage": round(energy_depreciation_percentage, 2),
                "dust_level_days": days_since_cleaning,
                "soiling_explanation_ok": bool(soiling_explanation_ok),
                "reported_soiling_loss_kw": round(reported_soiling_loss_kw, 4),
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
        try:
            if not ort_session:
                return jsonify({"error": "ONNX model is not loaded on the server."}), 500
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
                soiling_ok = False
                reported_soiling_loss = 0.0
                if 6 <= hour <= 18:
                    input_features_hist = np.array([[
                        sim_temp, sim_clouds, panel_age_in_days, days_since_cleaning, hour, day_of_year
                    ]], dtype=np.float32)
                    ort_inputs_hist = {ort_session.get_inputs()[0].name: input_features_hist}
                    predicted_loss_per_panel = float(ort_session.run(None, ort_inputs_hist)[0][0][0])

                    # Soiling monotonicity check for this simulated hour
                    try:
                        input_features_more_hist = np.array([[
                            sim_temp, sim_clouds, panel_age_in_days, days_since_cleaning + 7, hour, day_of_year
                        ]], dtype=np.float32)
                        ort_inputs_more_hist = {ort_session.get_inputs()[0].name: input_features_more_hist}
                        predicted_more = float(ort_session.run(None, ort_inputs_more_hist)[0][0][0])
                    except Exception:
                        predicted_more = predicted_loss_per_panel
                    soiling_ok = (predicted_more - predicted_loss_per_panel) > 0.0001
                    reported_soiling_loss = max(0.0, (predicted_more - predicted_loss_per_panel) * num_panels)

                total_predicted_loss = predicted_loss_per_panel * num_panels
                # Defensive: log implausible spikes coming from the model
                if predicted_loss_per_panel < 0 or predicted_loss_per_panel > 50:
                    app.logger.warning('Anomalous predicted_loss_per_panel at %s: %s kW (hour %s)', timestamp.isoformat(), predicted_loss_per_panel, hour)
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
                    # include both per-panel and system-level predictions to help frontend
                    "predicted_loss_per_panel_kw": round(predicted_loss_per_panel, 6),
                    "predicted_loss_kw": round(combined_total_loss_kw, 4),
                    "soiling_explanation_ok": bool(soiling_ok),
                    "reported_soiling_loss_kw": round(reported_soiling_loss, 4),
                    "energy_depreciation_percentage": round(energy_depreciation_percentage, 2),
                    "tilt_angle_deg": round(tilt_angle, 1),
                    "optimal_tilt_angle_deg": round(optimal_tilt, 1),
                    "tilt_penalty_percentage": round(tilt_penalty_pct, 2),
                    "tilt_loss_kw": round(tilt_loss_kw, 4),
                })
            return jsonify(history)
        except Exception as e:
            app.logger.exception('Error in /api/history')
            return jsonify({'error': str(e)}), 500

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


    @app.route('/api/model_metadata', methods=['GET'])
    def model_metadata():
        """Return model metadata written by the training script (model_metadata.json).
        If metadata is missing, attempt to return basic info about the model file.
        """
        metadata_path = os.path.join(script_dir, 'ml_training', 'saved_model', 'model_metadata.json')
        model_file_path = os.path.join(script_dir, 'ml_training', 'saved_model', 'loss_prediction_model.pkl')
        history_path = os.path.join(script_dir, 'ml_training', 'saved_model', 'metadata_history.jsonl')

        # If caller requested history (e.g., ?history=5), attempt to return last-N entries
        try:
            n_history = int(request.args.get('history', '0'))
        except Exception:
            n_history = 0

        if n_history > 0 and os.path.exists(history_path):
            try:
                # read last n lines efficiently
                def tail(path, n=10):
                    with open(path, 'rb') as fh:
                        fh.seek(0, os.SEEK_END)
                        filesize = fh.tell()
                        block_size = 1024
                        data = b''
                        lines = []
                        while filesize > 0 and len(lines) <= n:
                            read_size = min(block_size, filesize)
                            fh.seek(filesize - read_size)
                            chunk = fh.read(read_size)
                            data = chunk + data
                            lines = data.splitlines()
                            filesize -= read_size
                        lines = lines[-n:]
                        return [json.loads(line.decode('utf-8')) for line in lines]

                history_entries = tail(history_path, n_history)
                return jsonify({'history': history_entries})
            except Exception as e:
                return jsonify({'error': f'Failed to read history: {e}'}), 500

        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as fh:
                    return jsonify(json.load(fh))
            except Exception as e:
                return jsonify({'error': f'Failed to read metadata: {e}'}), 500

        # Fallback: try to return some minimal model info
        if os.path.exists(model_file_path):
            try:
                size_bytes = os.path.getsize(model_file_path)
                return jsonify({'model_file': model_file_path, 'size_bytes': size_bytes})
            except Exception as e:
                return jsonify({'error': f'Failed to stat model file: {e}'}), 500

        return jsonify({'error': 'No model metadata or model file found.'}), 404

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

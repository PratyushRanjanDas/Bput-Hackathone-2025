import joblib
import pandas as pd
import os
import config


class RecommendationService:
    _loss_model = None

    @classmethod
    def _get_model(cls):
        """Loads the loss prediction model."""
        if cls._loss_model is None:
            # UPDATED PATH: This path will work once the file is moved to the 'services' folder.
            script_dir = os.path.dirname(__file__)
            model_path = os.path.join(script_dir, '..', 'ml_training', 'saved_model', 'loss_prediction_model.pkl')
            try:
                print(f"Attempting to load model from: {os.path.abspath(model_path)}")
                cls._loss_model = joblib.load(model_path)
                print("Model loaded successfully.")
            except FileNotFoundError:
                print("Error: Model file not found at the specified path.")
                return None
        return cls._loss_model

    @classmethod
    def generate_recommendations(cls, current_conditions):
        """
        Predicts energy loss and generates a maintenance recommendation.

        Args:
            current_conditions (dict): A dictionary with current panel status.

            Example: {
                                        'temperature_celsius': 22,
                                        'cloud_cover_percentage': 20,
                                        'panel_age_in_days': 365,
                                        'days_since_cleaning': 45,
                                        'hour': 12,
                                        'day_of_year': 150
                                    }
        
        Returns:
            dict: A dictionary containing the prediction and a recommendation.
        """
        model = cls._get_model()
        if model is None:
            return {"error": "Loss prediction model not found."}

        try:
            # Prepare data for prediction
            df = pd.DataFrame([current_conditions])
            features_order = [
                'temperature_celsius', 'cloud_cover_percentage', 'panel_age_in_days',
                'days_since_cleaning', 'hour', 'day_of_year'
            ]
            df = df[features_order]

            # Predict the current hourly loss
            predicted_hourly_loss_kw = model.predict(df)[0]
            # print(model.predict(df))

            # --- Enhanced Recommendation Logic ---
            recommendations = []
            action_required = False

            # 1. Soiling and Cleaning Recommendation (based on financial loss)
            estimated_daily_loss_kwh = predicted_hourly_loss_kw * 8 # Assume 8 peak hours
            daily_financial_loss = estimated_daily_loss_kwh * config.ENERGY_VALUE_PER_KWH

            if daily_financial_loss > config.RECOMMENDATION_THRESHOLD_INR:
                action_required = True
                cleaning_recommendation = (
                    f"High energy loss detected due to soiling. "
                    f"Estimated daily financial loss: ₹{daily_financial_loss:.2f}. "
                    f"Recommend scheduling panel cleaning. The cost of cleaning (₹{config.CLEANING_COST}) "
                    f"could be recovered in approximately {config.CLEANING_COST / daily_financial_loss:.1f} days."
                )
                recommendations.append(cleaning_recommendation)

            # 2. High Cloud Cover Recommendation
            if current_conditions['cloud_cover_percentage'] > 75:
                recommendations.append(
                    "High cloud cover detected. Generation will be low. "
                    "Consider checking battery storage levels to ensure sufficient reserve power."
                )

            # 3. High Temperature Recommendation
            if current_conditions['temperature_celsius'] > 35:
                recommendations.append(
                    "High ambient temperature can reduce panel efficiency. "
                    "Ensure panels have adequate ventilation."
                )
            
            # 4. Panel Age Recommendation
            if current_conditions['panel_age_in_days'] > (10 * 365): # Over 10 years old
                recommendations.append(
                    "Panels are over 10 years old. Consider a professional inspection "
                    "for potential age-related degradation (LID, PID effects)."
                )

            # --- Finalizing the message ---
            if not recommendations:
                final_recommendation = "No immediate action required. System performing within expected parameters."
            else:
                # Join all recommendations into a single message
                final_recommendation = "\n\n".join(f"• {rec}" for rec in recommendations)


            return {
                "predicted_hourly_loss_kw": round(predicted_hourly_loss_kw, 4),
                "estimated_daily_financial_loss": round(daily_financial_loss, 2),
                "action_required": action_required,
                "recommendation_message": final_recommendation
            }

        except Exception as e:
            return {"error": f"An error occurred during recommendation generation: {e}"}


# Example of how to use the service
if __name__ == '__main__':
    # Scenario 1: Panels are clean
    clean_panel_conditions = {
        'temperature_celsius': 25, 'cloud_cover_percentage': 10,
        'panel_age_in_days': 180, 'days_since_cleaning': 5,
        'hour': 13, 'day_of_year': 185
    }
    print("--- Scenario 1: Clean Panels ---")
    recommendation1 = RecommendationService.generate_recommendations(
        clean_panel_conditions)
    print(recommendation1)

    # Scenario 2: Panels are dirty
    dirty_panel_conditions = {
        'temperature_celsius': 25, 'cloud_cover_percentage': 10,
        'panel_age_in_days': 180, 'days_since_cleaning': 60,  # 60 days since last clean
        'hour': 13, 'day_of_year': 185
    }
    print("\n--- Scenario 2: Dirty Panels ---")
    recommendation2 = RecommendationService.generate_recommendations(
        dirty_panel_conditions)
    print(recommendation2)
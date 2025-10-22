// filepath: src/services/offlineRecommendationService.js
import { InferenceSession, Tensor } from 'onnxruntime-web';

// --- Configuration & Constants ---
const MODERATE_LOSS_THRESHOLD_KW = 0.4;
const HIGH_LOSS_THRESHOLD_KW = 0.8;
const CRITICAL_LOSS_THRESHOLD_KW = 1.2;
const HIGH_TEMP_THRESHOLD_CELSIUS = 35;
const PANEL_AGE_THRESHOLD_YEARS = 10;
const HIGH_CLOUD_COVER_THRESHOLD = 75;
const SIMULATION_HOURS = 24;

let session;

// Function to load the model and create a session
async function getInferenceSession() {
  if (!session) {
    try {
      const modelPath = process.env.PUBLIC_URL + '/loss_prediction_model.onnx';
      session = await InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
      });
      console.log('ONNX model loaded successfully.');
    } catch (e) {
      console.error('Failed to load the ONNX model.', e);
      return null;
    }
  }
  return session;
}

/**
 * Simulates plausible weather and panel conditions for the next 24 hours.
 * This is a simplified model for client-side demonstration.
 * @param {object} currentConditions - The current state.
 * @returns {Array<object>} An array of 24 objects, each representing the features for a future hour.
 */
function simulateNext24Hours(currentConditions) {
  const simulatedData = [];
  const now = new Date();
  const currentHour = now.getHours();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));

  for (let i = 0; i < SIMULATION_HOURS; i++) {
    const hourOfDay = (currentHour + i) % 24;

    // Simulate temperature with a simple sinusoidal pattern (warmer during the day)
    const tempFluctuation = 5 * Math.sin((hourOfDay - 8) * (Math.PI / 12));
    const simulatedTemp = currentConditions.temperature_celsius + tempFluctuation;

    // Simulate cloud cover with slight random variations
    const cloudFluctuation = (Math.random() - 0.5) * 10;
    const simulatedCloudCover = Math.max(0, Math.min(100, currentConditions.cloud_cover_percentage + cloudFluctuation));

    simulatedData.push({
      temperature_celsius: simulatedTemp,
      cloud_cover: simulatedCloudCover, // Changed from cloud_cover_percentage to cloud_cover
      panel_age_in_days: currentConditions.panel_age_in_days,
      days_since_cleaning: currentConditions.days_since_cleaning + Math.floor(i / 24),
      hour: hourOfDay, // Corrected feature name
      day_of_year: dayOfYear,
    });
  }
  return simulatedData;
}

// This function is now at the top level, accessible by other functions in this module.
const runPrediction = async (temperature, cloud_cover, panel_age_in_days, days_since_cleaning, hour_of_day, solar_irradiance) => {
  await getInferenceSession();
  try {
    const inputData = new Float32Array([
      temperature,
      cloud_cover,
      panel_age_in_days,
      days_since_cleaning,
      hour_of_day,
      solar_irradiance,
    ]);
    const feeds = {
      'float_input': new Tensor('float32', inputData, [1, 6])
    };
    const results = await session.run(feeds);
    const predicted_loss_kw = results.variable.data[0];

    let action_required = false;
    let recommendation_message = 'System is operating normally. No immediate action required.';

    // Keep existing kW thresholds for legacy logic, but also provide percent-based guidance via energy depreciation below.
    if (predicted_loss_kw >= HIGH_LOSS_THRESHOLD_KW) {
      action_required = true;
      recommendation_message = `High energy loss detected (${predicted_loss_kw.toFixed(2)} kW). Immediate panel cleaning is recommended to restore efficiency.`;
    } else if (predicted_loss_kw >= MODERATE_LOSS_THRESHOLD_KW) {
      action_required = true;
      recommendation_message = `Moderate energy loss detected (${predicted_loss_kw.toFixed(2)} kW). Consider scheduling a panel cleaning soon.`;
    }

    return { predicted_loss_kw, action_required, recommendation_message };

  } catch (e) {
    console.error(`Prediction run failed: ${e}`);
    // Return a structured error object
    return {
      error: 'Failed to run offline prediction.',
      predicted_loss_kw: 0,
      action_required: true,
      recommendation_message: 'Error during prediction. Check console for details.'
    };
  }
};

// --- Public API ---
export const generateOfflineRecommendation = async (currentConditions) => {
  const modelSession = await getInferenceSession();
  if (!modelSession) return { error: 'Model not available.' };

  try {
    const simulatedHours = simulateNext24Hours(currentConditions);

    // Run predictions for each hour and aggregate hourly kW losses to daily kWh per panel
    const hourly_losses_kw = [];
    let peak_loss_kw = 0;

    for (const hourData of simulatedHours) {
      // Only consider daylight hours where production occurs (6-18 local hour)
      if (hourData.hour >= 6 && hourData.hour <= 18) {
        const features = [
          hourData.temperature_celsius,
          hourData.cloud_cover,
          hourData.panel_age_in_days,
          hourData.days_since_cleaning,
          hourData.hour,
          hourData.day_of_year,
        ];

        const inputTensor = new Tensor('float32', features, [1, 6]);
        const feeds = { float_input: inputTensor };
        const results = await modelSession.run(feeds);
        const predicted_hourly_loss_kw = results.variable.data[0];

        hourly_losses_kw.push(predicted_hourly_loss_kw);
        if (predicted_hourly_loss_kw > peak_loss_kw) peak_loss_kw = predicted_hourly_loss_kw;
      }
    }

  // --- Tiered Recommendation Logic (mirrors backend) but also return daily kWh and percent-based guidance ---
  const recommendations = [];
  let action_required_kw = false;

  if (peak_loss_kw > CRITICAL_LOSS_THRESHOLD_KW) {
    recommendations.push(
      `CRITICAL: Immediate action required. A severe energy loss of ${peak_loss_kw.toFixed(2)} kW is predicted, ` +
      `likely from heavy soiling over the past ${currentConditions.days_since_cleaning} days. ` +
      "Action: Schedule immediate professional cleaning and inspection."
    );
    action_required_kw = true;
  } else if (peak_loss_kw > HIGH_LOSS_THRESHOLD_KW) {
    recommendations.push(
      `High Priority: A significant energy loss of ${peak_loss_kw.toFixed(2)} kW is predicted. ` +
      "Efficiency is likely impacted by soiling. " +
      "Action: Schedule panel cleaning soon to restore performance."
    );
    action_required_kw = true;
  } else if (peak_loss_kw > MODERATE_LOSS_THRESHOLD_KW) {
    recommendations.push(
      `Moderate Priority: A noticeable energy loss of ${peak_loss_kw.toFixed(2)} kW is predicted. ` +
      "This may be due to accumulating dust. " +
      "Action: Plan to clean panels in the near future to prevent further loss."
    );
    action_required_kw = true;
  }

  if (currentConditions.temperature_celsius > HIGH_TEMP_THRESHOLD_CELSIUS) {
    recommendations.push(
      `Weather Factor: High temperature (${currentConditions.temperature_celsius.toFixed(1)}°C) can reduce panel efficiency. ` +
      "Solution: Ensure panels have adequate ventilation to dissipate heat."
    );
  }

  if (currentConditions.cloud_cover_percentage > HIGH_CLOUD_COVER_THRESHOLD) {
    recommendations.push(
      `Weather Factor: Heavy cloud cover (${currentConditions.cloud_cover_percentage}%) will limit power generation. ` +
      "This is temporary and no action is needed."
    );
  }

  if (currentConditions.panel_age_in_days > (PANEL_AGE_THRESHOLD_YEARS * 365)) {
    recommendations.push(
      `Long-Term: Panels are over ${PANEL_AGE_THRESHOLD_YEARS} years old. ` +
      "Consider a professional inspection for age-related degradation."
    );
  }

  let final_recommendation;
  if (recommendations.length === 0) {
    final_recommendation = "No immediate action required. System performing within expected parameters.";
  } else {
    final_recommendation = recommendations.join(" ");
  }

  // Aggregate hourly kW losses to per-panel daily kWh (sum of each hour's kW => kWh for 1 hour slots)
  const daily_kwh_per_panel = Math.round((hourly_losses_kw.reduce((s, v) => s + v, 0)) * 10000) / 10000;

  // Determine the ideal per-panel daily kWh to compute percentage depreciation.
  // Prefer an explicit value passed in currentConditions.ideal_daily_kwh_per_panel (kWh/day per panel).
  // Fallback to representative ideal (0.45 kW * 24h) when not provided.
  const representativeIdealPerPanelKw = 0.45;
  const idealDailyPerPanelKwh = (currentConditions && currentConditions.ideal_daily_kwh_per_panel)
    ? currentConditions.ideal_daily_kwh_per_panel
    : representativeIdealPerPanelKw * 24;

  // Total system daily loss uses provided num_panels if available
  const numPanels = (currentConditions && currentConditions.num_panels) ? currentConditions.num_panels : 1;
  const total_system_daily_loss_kwh = Math.round((daily_kwh_per_panel * numPanels) * 10000) / 10000;

  const energy_depreciation_percentage = idealDailyPerPanelKwh > 0 ? (daily_kwh_per_panel / idealDailyPerPanelKwh) * 100 : 0;

  // Also expose a percent-based action flag (align with backend thresholds)
  const MODERATE_PCT = 5; // percent
  const HIGH_PCT = 10; // percent
  const CRITICAL_PCT = 20; // percent
  let action_required_pct = false;
  if (energy_depreciation_percentage >= CRITICAL_PCT) action_required_pct = true;
  else if (energy_depreciation_percentage >= HIGH_PCT) action_required_pct = true;

    return {
      predicted_loss_kw: peak_loss_kw,
      // expose the aggregated daily kWh per panel and system
      predicted_daily_loss_kwh_per_panel: daily_kwh_per_panel,
      total_system_daily_loss_kwh,
      energy_depreciation_percentage,
      action_required: action_required_kw || action_required_pct,
      recommendation_message: final_recommendation,
      hourly_losses_kw, // include raw hourly kW list for debugging/visualization if needed
    };
  } catch (e) {
    console.error('An error occurred during offline recommendation generation:', e);
    return { error: 'Failed to generate recommendation.' };
  }
};

export const generateOfflineHistory = async (panelAge, daysSinceCleaning, baseTemp, baseCloud) => {
  const history = [];
  const now = new Date(); // Get the current time to base our history on

  for (let i = 23; i >= 0; i--) { // Loop backwards to create a chronological history
    const hourTimestamp = new Date(now);
    hourTimestamp.setHours(now.getHours() - i);
    const hour = hourTimestamp.getHours();

    // Simulate temperature variation (cooler at night, warmer mid-day) based on user input
    const tempVariation = Math.sin((hour - 6) * (Math.PI / 12)) * 8; // Sin wave for temp, slightly less variation
    const temperature = baseTemp + tempVariation;

    // Simulate cloud cover variation around the user's input
    const cloudVariation = (Math.random() * 20 - 10); // +/- 10%
    const cloud_cover = Math.max(0, Math.min(100, baseCloud + cloudVariation));

    // Simulate solar irradiance based on time of day
    const sunAngle = Math.sin(Math.max(0, (hour - 6) * (Math.PI / 12)));
    const solar_irradiance = sunAngle > 0 ? 1000 * sunAngle * (1 - cloud_cover / 150) : 0;

    const { predicted_loss_kw } = await runPrediction(temperature, cloud_cover, panelAge, daysSinceCleaning, hour, solar_irradiance);

    history.push({
      timestamp: hourTimestamp.toISOString(), // <-- The FIX: Add a valid ISO timestamp
      hour,
      temperature_celsius: temperature, // Match the key used by the online history
      cloud_cover: cloud_cover, // Changed from cloud_cover_percentage to cloud_cover
      predicted_loss_kw,
    });
  }
  return history;
};

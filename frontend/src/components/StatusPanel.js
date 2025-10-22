// filepath: src/components/StatusPanel.js
import React from 'react';

const StatusPanel = ({ liveData }) => {
  if (!liveData) {
    return (
      <div className="status-panel">
        <h3>Current Weather Status</h3>
        <p>No live data available. Please complete the analysis on the Home page.</p>
      </div>
    );
  }

  const weather = liveData.live_weather;
  const status = liveData.live_status;
  const numPanels = liveData.num_panels ?? status.num_panels ?? null;
  // Preferred order for showing single-panel daily loss (kWh/d):
  // 1) predicted_daily_loss_kwh_per_panel
  // 2) total_system_daily_loss_kwh / num_panels
  // 3) predicted_hourly_loss_kw * 24
  // 4) N/A
  let perPanelDailyLoss = null;
  // Prefer explicit per-panel daily prediction when it's a positive number.
  if (typeof status?.predicted_daily_loss_kwh_per_panel === 'number' && status.predicted_daily_loss_kwh_per_panel > 0) {
    perPanelDailyLoss = status.predicted_daily_loss_kwh_per_panel;
  } else if (typeof status?.total_system_daily_loss_kwh === 'number' && numPanels) {
    // Fall back to dividing total system daily loss by number of panels when per-panel prediction is missing or zero.
    perPanelDailyLoss = status.total_system_daily_loss_kwh / numPanels;
  } else if (typeof status?.predicted_hourly_loss_kw === 'number') {
    perPanelDailyLoss = status.predicted_hourly_loss_kw * 24;
  }

  return (
    <div className="status-panel">
      <h3>Current Weather Status</h3>
      <div className="weather-grid">
        <div className="weather-item">
          <span className="weather-label">Temperature</span>
          <span className="weather-value">{weather.temperature_celsius?.toFixed(1)} °C</span>
        </div>
        <div className="weather-item">
          <span className="weather-label">Cloud Cover</span>
          <span className="weather-value">{(weather.cloud_cover_percentage ?? weather.cloud_cover)} %</span>
        </div>
        <div className="weather-item">
          <span className="weather-label">UV Index</span>
          <span className="weather-value">{weather.uv_index !== undefined ? weather.uv_index?.toFixed(1) : 'N/A'}</span>
        </div>
        <div className="weather-item">
          <span className="weather-label">Energy Depreciation</span>
          <span className="weather-value depreciation">
            {typeof status.energy_depreciation_percentage === 'number' ? status.energy_depreciation_percentage.toFixed(2) : 'N/A'} %
          </span>
        </div>
        <div className="weather-item">
          <span className="weather-label">Dust Level (Days)</span>
          <span className="weather-value">{status.dust_level_days}</span>
        </div>
        <div className="weather-item">
          <span className="weather-label">Total System Loss</span>
          <span className="weather-value loss">{typeof status.total_system_daily_loss_kwh === 'number' ? status.total_system_daily_loss_kwh.toFixed(3) : (typeof status.total_system_loss_kw === 'number' ? (status.total_system_loss_kw*24).toFixed(3) : 'N/A')} kWh/d</span>
        </div>
        <div className="weather-item">
          <span className="weather-label">Predicted Daily Loss (per panel)</span>
          <span className="weather-value">{typeof perPanelDailyLoss === 'number' ? perPanelDailyLoss.toFixed(4) + ' kWh/d' : 'N/A'}</span>
        </div>
        {status?.tilt_angle_deg !== undefined && (
          <div className="weather-item">
            <span className="weather-label">Tilt</span>
            <span className="weather-value">{status.tilt_angle_deg}° (opt {status.optimal_tilt_angle_deg}°)</span>
          </div>
        )}
        {status?.tilt_penalty_percentage !== undefined && (
          <div className="weather-item">
            <span className="weather-label">Tilt Penalty</span>
            <span className="weather-value">{status.tilt_penalty_percentage}% ({typeof status.tilt_loss_kw === 'number' ? ( (status.tilt_loss_kw*24).toFixed(3) + ' kWh/d' ) : 'N/A'})</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusPanel;

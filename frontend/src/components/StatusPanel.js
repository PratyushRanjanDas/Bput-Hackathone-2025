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
          <span className="weather-value">{weather.uv_index?.toFixed(1)}</span>
        </div>
        <div className="weather-item">
          <span className="weather-label">Energy Depreciation</span>
          <span className="weather-value depreciation">
            {status.energy_depreciation_percentage?.toFixed(2)} %
          </span>
        </div>
        <div className="weather-item">
          <span className="weather-label">Dust Level (Days)</span>
          <span className="weather-value">{status.dust_level_days}</span>
        </div>
        <div className="weather-item">
          <span className="weather-label">Total System Loss</span>
          <span className="weather-value loss">{status.total_system_loss_kw?.toFixed(3)} kW</span>
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
            <span className="weather-value">{status.tilt_penalty_percentage}% ({status.tilt_loss_kw} kW)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusPanel;

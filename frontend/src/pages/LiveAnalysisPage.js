import React, { useEffect, useState } from 'react';
import StatusPanel from '../components/StatusPanel';
import RecommendationCard from '../components/RecommendationCard';
import './LiveAnalysisPage.css';

function LiveAnalysisPage({ liveData }) {
  const [showLossToast, setShowLossToast] = useState(false);
  useEffect(() => {
    if (liveData?.live_status?.energy_depreciation_percentage >= 10) {
      setShowLossToast(true);
      const t = setTimeout(() => setShowLossToast(false), 6000);
      return () => clearTimeout(t);
    }
  }, [liveData]);

  if (!liveData) {
    return (
      <div className="live-analysis-page">
        <div className="no-data-message">
          <h2>No Live Data Available</h2>
          <p>Please go to the Home page and run an analysis first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-analysis-page">
      {showLossToast && (
        <div className="toast toast-warning" onClick={() => setShowLossToast(false)}>
          ⚠️ Energy loss exceeds 10%. Consider taking action.
        </div>
      )}
      <div className="page-header">
        <h1>Live Analysis</h1>
        <p>Real-time performance monitoring and recommendations</p>
      </div>

      <div className="analysis-grid">
        <div className="status-section">
          <h2>Current Status</h2>
          <StatusPanel liveData={liveData} />
        </div>

        <div className="recommendation-section">
          <h2>AI Recommendations</h2>
          <RecommendationCard liveData={liveData} />
        </div>
      </div>

      <div className="weather-details">
        <h2>Weather Conditions</h2>
        <div className="weather-grid">
          <div className="weather-card">
            <div className="weather-icon">🌡️</div>
            <div className="weather-label">Temperature</div>
            <div className="weather-value">
              {liveData.live_weather?.temperature_celsius?.toFixed(1) || 'N/A'}°C
            </div>
          </div>
          <div className="weather-card">
            <div className="weather-icon">☁️</div>
            <div className="weather-label">Cloud Cover</div>
            <div className="weather-value">
              {(liveData.live_weather?.cloud_cover_percentage ?? liveData.live_weather?.cloud_cover ?? 'N/A') + (typeof liveData.live_weather?.cloud_cover_percentage === 'number' || typeof liveData.live_weather?.cloud_cover === 'number' ? '%' : '')}
            </div>
          </div>
          <div className="weather-card">
            <div className="weather-icon">☀️</div>
            <div className="weather-label">UV Index</div>
            <div className="weather-value">
              {liveData.live_weather?.uv_index?.toFixed(1) || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      <div className="tilt-details">
        <h2>Orientation & Tilt</h2>
        <div className="tilt-grid">
          <div className="tilt-card">
            <div className="tilt-label">Current Tilt</div>
            <div className="tilt-value">{liveData.live_status?.tilt_angle_deg ?? 'N/A'}°</div>
          </div>
          <div className="tilt-card">
            <div className="tilt-label">Optimal Tilt (Seasonal)</div>
            <div className="tilt-value">{liveData.live_status?.optimal_tilt_angle_deg ?? 'N/A'}°</div>
          </div>
          <div className="tilt-card">
            <div className="tilt-label">Tilt Penalty</div>
            <div className="tilt-value">{typeof liveData.live_status?.tilt_penalty_percentage === 'number' ? `${liveData.live_status.tilt_penalty_percentage}%` : 'N/A'}</div>
          </div>
          <div className="tilt-card">
            <div className="tilt-label">Tilt Loss</div>
            <div className="tilt-value">{typeof liveData.live_status?.tilt_loss_kw === 'number' ? `${liveData.live_status.tilt_loss_kw} kW` : 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveAnalysisPage;

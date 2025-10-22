// filepath: src/components/RecommendationCard.js
import React from 'react';

const RecommendationCard = ({ liveData }) => {
  if (!liveData) {
    return (
      <div className="recommendation-card">
        <div className="card-header">
          <h3>💡 Recommendation</h3>
        </div>
        <div className="card-content">
          <p>No analysis available. Please complete the analysis on the Home page.</p>
        </div>
      </div>
    );
  }

  const status = liveData.live_status;
  // Preferred order for showing single-panel daily loss (kWh/d):
  // 1) predicted_daily_loss_kwh_per_panel
  // 2) total_system_daily_loss_kwh / num_panels
  // 3) predicted_hourly_loss_kw * 24
  // 4) N/A
  const numPanels = status?.num_panels ?? null;
  let singlePanelDaily = null;
  if (typeof status?.predicted_daily_loss_kwh_per_panel === 'number' && status.predicted_daily_loss_kwh_per_panel > 0) {
    singlePanelDaily = status.predicted_daily_loss_kwh_per_panel;
  } else if (typeof status?.total_system_daily_loss_kwh === 'number' && numPanels) {
    singlePanelDaily = status.total_system_daily_loss_kwh / numPanels;
  } else if (typeof status?.predicted_hourly_loss_kw === 'number') {
    singlePanelDaily = status.predicted_hourly_loss_kw * 24;
  }
  
  // Dynamically set the card's style based on whether action is required
  const cardClassName = status.action_required 
    ? 'recommendation-card action-needed' 
    : 'recommendation-card';

  return (
    <div className={cardClassName}>
      <div className="card-header">
        <h3>
          {status.action_required ? '🔧 Action Required' : '✅ All Good'}
        </h3>
      </div>
      <div className="card-content">
        <p className="recommendation-message">{status.recommendation_message}</p>
        <div className="details">
          <div className="detail-item">
            <span className="detail-label">Predicted Daily Loss (Single Panel):</span>
            <span className="detail-value">{typeof singlePanelDaily === 'number' ? singlePanelDaily.toFixed(4) : 'N/A'} kWh/d</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total System Daily Loss:</span>
            <span className="detail-value">{typeof status.total_system_daily_loss_kwh === 'number' ? status.total_system_daily_loss_kwh.toFixed(3) : (typeof status.total_system_loss_kw === 'number' ? (status.total_system_loss_kw*24).toFixed(3) : 'N/A')} kWh/d</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Est. Daily Financial Loss:</span>
            <span className="detail-value">₹{status.estimated_daily_financial_loss?.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecommendationCard;

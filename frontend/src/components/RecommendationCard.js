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
            <span className="detail-label">Predicted Hourly Loss (Single Panel):</span>
            <span className="detail-value">{status.predicted_hourly_loss_kw?.toFixed(4)} kW</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total System Loss:</span>
            <span className="detail-value">{status.total_system_loss_kw?.toFixed(3)} kW</span>
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

// filepath: src/components/RecommendationCard.js
import React from 'react';

const RecommendationCard = ({ result }) => {
  if (!result) return null; // Don't render if there's no result yet

  if (result.error) {
    return (
      <div className="recommendation-card error">
        <div className="card-header">
          <h3>⚠️ Error</h3>
        </div>
        <div className="card-content">
          <p>{result.error}</p>
        </div>
      </div>
    );
  }

  // Dynamically set the card's style based on whether action is required
  const cardClassName = result.action_required ? 'recommendation-card action-needed' : 'recommendation-card';

  return (
    <div className={cardClassName}>
      <div className="card-header">
        <h3>
          {result.action_required ? '🔧 Action Required' : '✅ All Good'}
        </h3>
      </div>
      <div className="card-content">
        <p className="recommendation-message">{result.recommendation_message}</p>
        <div className="details">
          <div className="detail-item">
            <span className="detail-label">Predicted Hourly Loss:</span>
            <span className="detail-value">{result.predicted_hourly_loss_kw.toFixed(4)} kW</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Est. Daily Financial Loss:</span>
            <span className="detail-value">₹{result.estimated_daily_financial_loss.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecommendationCard;

// filepath: src/components/StatusPanel.js
import React, { useState, useEffect } from 'react';

const StatusPanel = ({ onGetRecommendation }) => {
  // State for user inputs
  const [installDate, setInstallDate] = useState('');
  const [cleanedDate, setCleanedDate] = useState('');
  const [temperature, setTemperature] = useState('25');
  const [cloudCover, setCloudCover] = useState('10');

  // --- LocalStorage Logic ---
  // On component mount, load saved dates from localStorage
  useEffect(() => {
    const savedInstallDate = localStorage.getItem('solar_installDate');
    const savedCleanedDate = localStorage.getItem('solar_cleanedDate');
    if (savedInstallDate) setInstallDate(savedInstallDate);
    if (savedCleanedDate) setCleanedDate(savedCleanedDate);
  }, []);

  // When dates change, save them to localStorage
  useEffect(() => {
    if (installDate) localStorage.setItem('solar_installDate', installDate);
  }, [installDate]);

  useEffect(() => {
    if (cleanedDate) localStorage.setItem('solar_cleanedDate', cleanedDate);
  }, [cleanedDate]);
  
  // --- Handler for the button click ---
  const handleSubmit = () => {
    if (!installDate || !cleanedDate) {
      alert('Please select both an installation and a cleaning date.');
      return;
    }

    // Calculate days from dates
    const today = new Date();
    const panel_age_in_days = Math.floor((today - new Date(installDate)) / (1000 * 60 * 60 * 24));
    const days_since_cleaning = Math.floor((today - new Date(cleanedDate)) / (1000 * 60 * 60 * 24));

    // Pass all data up to the parent component (App.js)
    onGetRecommendation({
      temperature_celsius: parseFloat(temperature),
      cloud_cover_percentage: parseFloat(cloudCover),
      panel_age_in_days,
      days_since_cleaning,
    });
  };

  return (
    <div className="status-panel">
      <h3>Panel Status</h3>
      <div className="input-group">
        <label>Panel Installation Date:</label>
        <input 
          type="date" 
          value={installDate} 
          onChange={(e) => setInstallDate(e.target.value)}
          className="date-input"
        />
      </div>
      <div className="input-group">
        <label>Last Cleaned Date:</label>
        <input 
          type="date" 
          value={cleanedDate} 
          onChange={(e) => setCleanedDate(e.target.value)}
          className="date-input"
        />
      </div>
      <div className="input-group">
        <label>Current Temperature (°C):</label>
        <input 
          type="number" 
          value={temperature} 
          onChange={(e) => setTemperature(e.target.value)}
          className="number-input"
          min="0"
          max="50"
          step="0.1"
        />
      </div>
      <div className="input-group">
        <label>Cloud Cover (%):</label>
        <input 
          type="number" 
          value={cloudCover} 
          onChange={(e) => setCloudCover(e.target.value)}
          className="number-input"
          min="0"
          max="100"
          step="1"
        />
      </div>
      <button onClick={handleSubmit} className="submit-button">
        Get Recommendation
      </button>
    </div>
  );
};

export default StatusPanel;

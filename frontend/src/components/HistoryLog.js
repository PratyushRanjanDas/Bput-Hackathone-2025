import React from 'react';
import './HistoryLog.css';

function HistoryLog({ historyData }) {
    if (!historyData || historyData.length === 0) {
        return (
            <div className="history-log">
                <h2>History Log</h2>
                <p className="no-data">No history data available. Please run an analysis first.</p>
            </div>
        );
    }

    return (
        <div className="history-log">
            <h2>Hourly Performance Log</h2>
            <p className="subtitle">Last 24 hours of solar panel performance data</p>

            <div className="table-container">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Dust Level (Days)</th>
                            <th>Energy Depreciation (%)</th>
                            <th>Temperature (°C)</th>
                            <th>Cloud Cover (%)</th>
                            <th>UV Index</th>
                            <th>Predicted Loss (kWh/d)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historyData.map((entry, index) => {
                            const date = new Date(entry.timestamp);
                            const formattedDate = date.toLocaleDateString();
                            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                                <tr key={index}>
                                    <td className="datetime-cell">
                                        <div className="date">{formattedDate}</div>
                                        <div className="time">{formattedTime}</div>
                                    </td>
                                    <td>{entry.dust_level_days !== undefined ? entry.dust_level_days : 'N/A'}</td>
                                    <td className={entry.energy_depreciation_percentage > 50 ? 'high-depreciation' : ''}>
                                        {entry.energy_depreciation_percentage !== undefined ? entry.energy_depreciation_percentage.toFixed(2) + '%' : 'N/A'}
                                    </td>
                                    <td>{entry.temperature_celsius !== undefined ? entry.temperature_celsius.toFixed(1) + '°C' : 'N/A'}</td>
                                    <td>{(entry.cloud_cover_percentage !== undefined ? entry.cloud_cover_percentage : entry.cloud_cover !== undefined ? entry.cloud_cover : 'N/A')}{entry.cloud_cover_percentage !== undefined || entry.cloud_cover !== undefined ? '%' : ''}</td>
                                    <td>{entry.uv_index !== undefined ? entry.uv_index.toFixed(1) : 'N/A'}</td>
                                    <td>{entry.predicted_loss_kwh !== undefined ? entry.predicted_loss_kwh.toFixed(4) + ' kWh/d' : (entry.predicted_loss_kw !== undefined ? (entry.predicted_loss_kw*24).toFixed(4) + ' kWh/d' : 'N/A')}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default HistoryLog;

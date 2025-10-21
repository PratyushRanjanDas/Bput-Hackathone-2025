import React from 'react';
import HistoryGraph from '../components/HistoryGraph';
import './GraphPage.css';

function GraphPage({ historyData }) {
  if (!historyData || historyData.length === 0) {
    return (
      <div className="graph-page">
        <div className="no-data-message">
          <h2>No Graph Data Available</h2>
          <p>Please go to the Home page and run an analysis first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-page">
      <div className="page-header">
        <h1>Performance Graph</h1>
        <p>24-hour historical performance visualization</p>
      </div>

      <div className="graph-container">
        <HistoryGraph data={historyData} />
      </div>
    </div>
  );
}

export default GraphPage;

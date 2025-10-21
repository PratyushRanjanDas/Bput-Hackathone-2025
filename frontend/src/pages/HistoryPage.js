import React from 'react';
import HistoryLog from '../components/HistoryLog';
import './HistoryPage.css';

function HistoryPage({ historyData }) {
  return (
    <div className="history-page">
      <HistoryLog historyData={historyData} />
    </div>
  );
}

export default HistoryPage;

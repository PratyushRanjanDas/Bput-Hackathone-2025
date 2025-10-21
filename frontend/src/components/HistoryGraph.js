import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const HistoryGraph = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="history-card-empty">
        <h3>Historical Data</h3>
        <p>No historical data available to display.</p>
      </div>
    );
  }

  const chartData = {
    labels: data.map(item => new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })),
    datasets: [
      {
        label: 'Predicted Loss (kW)',
        data: data.map(item => item.predicted_loss_kw),
        borderColor: '#ff7300',
        backgroundColor: 'rgba(255, 115, 0, 0.2)',
        fill: false,
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: 'Temperature (°C)',
        data: data.map(item => item.temperature_celsius),
        borderColor: '#8884d8',
        backgroundColor: 'rgba(136, 132, 216, 0.1)',
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
      },
      {
        label: 'Cloud Cover (%)',
        data: data.map(item => (item.cloud_cover_percentage ?? item.cloud_cover)),
        borderColor: '#82ca9d',
        backgroundColor: 'rgba(130, 202, 157, 0.1)',
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Allow chart to fill container
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
            color: '#333'
        }
      },
      title: {
        display: true,
        text: '24-Hour Performance Analysis',
        color: '#333',
        font: {
            size: 18
        }
      },
    },
    scales: {
        x: {
            ticks: { 
              color: '#333',
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
            grid: { color: 'rgba(0, 0, 0, 0.1)'}
        },
        y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
                display: true,
                text: 'Predicted Loss (kW)',
                color: '#ff7300'
            },
            ticks: { color: '#ff7300' },
            grid: { color: 'rgba(0, 0, 0, 0.1)'}
        },
        y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
                display: true,
                text: 'Temp (°C) / Cloud (%)',
                color: '#333'
            },
            ticks: { color: '#333' },

            grid: {
                drawOnChartArea: false, // only draw grid lines for the first Y axis
            },
        },
    }
  };

  return (
    <>
      <Line data={chartData} options={options} />
    </>
  );
};

export default HistoryGraph;

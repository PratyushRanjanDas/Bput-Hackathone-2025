---
layout: default
title: Home
---

# Solar Panel Optimizer

A full-stack web application to monitor and optimize solar panel performance using real-time weather, AI-powered loss prediction, and actionable recommendations.

---

## Features {#features}

- **Live Analysis**: Real-time monitoring of panel performance, weather, and predicted energy loss.
- **AI-Powered Loss Prediction**: Uses an ONNX machine learning model to estimate energy loss due to dust, age, tilt, and weather.
- **Offline Mode**: Simulates predictions when backend is unavailable, using heuristics and cached weather.
- **Actionable Recommendations**: Provides cleaning, tilt adjustment, and maintenance advice based on predicted losses.
- **History & Trends**: Tracks historical performance and dust accumulation for long-term insights.
- **Push Notifications**: Alerts users when energy loss exceeds thresholds.

---

## Tech Stack {#tech-stack}

### Frontend
- **React.js** - Modern UI framework
- **Service Worker** - Push notifications support
- **ONNX Runtime** - Client-side AI model inference

### Backend
- **Flask (Python)** - RESTful API server
- **ONNX Model** - Fast AI inference
- **OpenWeather API** - Real-time weather data integration

### Hardware Integration
- **Arduino/C++** - IoT sensor data collection
- **Real-time Monitoring** - Live panel performance tracking

### Machine Learning
- Trained on historical panel data (temperature, cloud cover, age, cleaning interval)
- Predicts instantaneous system loss (kW)
- Continuously updated with real-world performance data

---

## How It Works {#demo}

### 1. Enter Panel Details
- Installation date
- Dust density
- Number of panels
- Ideal generation (kWh/day per panel)
- Tilt angle

### 2. Run Analysis
- See live weather conditions
- View predicted energy losses
- Get actionable recommendations

### 3. View History
- Explore past performance
- Track cleaning impact
- Analyze long-term trends

### 4. Receive Alerts
- Get notified when action is needed
- Threshold-based alerts
- Push notification support

---

## Getting Started

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python3 app.py
```
Backend runs at `http://127.0.0.1:5001`

### Frontend Setup
```bash
cd frontend
npm install
npm start
```
Frontend runs at `http://localhost:3000`

---

## Project Structure

```
.
├── backend/              # Flask API server
│   ├── api/             # API routes
│   ├── data/            # Historical datasets
│   ├── ml_training/     # Model training scripts
│   └── services/        # Business logic
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   └── services/    # API and logic services
│   └── public/          # Static assets
├── arduino_sketches/    # Hardware integration code
└── docs/               # GitHub Pages documentation
```

---

## Key Features

### AI-Powered Predictions
The system uses a trained ONNX model to predict energy loss based on:
- Current weather conditions
- Panel age and maintenance history
- Dust accumulation levels
- Tilt angle optimization
- Historical performance data

### Robust Architecture
- **Error Handling**: Graceful degradation with offline mode
- **Unit Consistency**: Automatic conversion between kWh/day and kW
- **Logging**: Comprehensive backend logging for debugging
- **Validation**: Input validation and range checking

### Real-World Ready
- IoT hardware integration
- Mobile-responsive design
- Push notification support
- Offline capability
- Scalable architecture

---

## Hackathon Highlights

✅ **End-to-End Solution**: From data input to actionable advice  
✅ **AI-Driven**: Real machine learning, not just heuristics  
✅ **Robust**: Handles errors, offline mode, and edge cases gracefully  
✅ **Scalable**: Can integrate with IoT hardware or mobile apps  
✅ **Innovative**: Combines weather data, ML predictions, and user-friendly UI

---

## Team

**Pratyush Ranjan Das** and team

---

## Repository

[View on GitHub](https://github.com/PratyushRanjanDas/Bput-Hackathone-2025)

---

## License

MIT License - see the repository for details

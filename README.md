# Solar Panel Optimizer

A full-stack web application to monitor and optimize solar panel performance using real-time weather, AI-powered loss prediction, and actionable recommendations.

---

## Features
- **Live Analysis**: Real-time monitoring of panel performance, weather, and predicted energy loss.
- **AI-Powered Loss Prediction**: Uses an ONNX machine learning model to estimate energy loss due to dust, age, tilt, and weather.
- **Offline Mode**: Simulates predictions when backend is unavailable, using heuristics and cached weather.
- **Actionable Recommendations**: Provides cleaning, tilt adjustment, and maintenance advice based on predicted losses.
- **History & Trends**: Tracks historical performance and dust accumulation for long-term insights.
- **Push Notifications**: Alerts users when energy loss exceeds thresholds.

---

## Tech Stack
- **Frontend**: React.js, modern UI, service worker for push notifications.
- **Backend**: Flask (Python), ONNX model for fast AI inference, OpenWeather API integration.
- **Model Training**: Trained on historical panel data (temperature, cloud cover, age, cleaning interval, etc.), predicts instantaneous system loss (kW).

---

## Project Structure

```
.
├── backend
│   ├── api
│   │   ├── __init__.py
│   │   └── routes.py
│   ├── data
│   │   ├── historical_loss_data.csv
│   │   └── historical_solar_data.csv
│   ├── ml_training
│   │   ├── saved_model
│   │   │   ├── loss_prediction_model.onnx
│   │   │   ├── model_metadata.json
│   │   │   └── backup/
│   │   └── scripts
│   │       ├── 1_simulate_historical_data.py
│   │       ├── 1b_simulate_loss_data.py
│   │       ├── 2_train_model.py
│   │       ├── 2b_train_loss_model.py
│   │       ├── 3_convert_model_to_onnx.py
│   │       ├── 3_generate_dataset.py
│   │       └── 4_evaluate_model.py
│   ├── services
│   │   ├── __init__.py
│   │   └── recommendation_service.py
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   └── requirements.txt
├── frontend
│   ├── build/
│   ├── public/
│   │   ├── index.html
│   │   ├── loss_prediction_model.onnx
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src
│   │   ├── components/
│   │   │   ├── HistoryGraph.js
│   │   │   ├── RecommendationCard.js
│   │   │   ├── StatusPanel.js
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── GraphPage.js
│   │   │   ├── HardwareIntegrationPage.js
│   │   │   ├── HistoryPage.js
│   │   │   ├── HomePage.js
│   │   │   ├── LiveAnalysisPage.js
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── arduinoService.js
│   │   │   ├── historyService.js
│   │   │   ├── offlineRecommendationService.js
│   │   │   └── onlineRecommendationService.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── ...
│   └── package.json
└── README.md
```

---

## How to Run the Project

**1. Run the Backend Server**
```bash
cd backend
pip install -r requirements.txt
python3 app.py
```
Backend runs at `http://127.0.0.1:5001`.

**2. Run the Frontend Application**
```bash
cd frontend
npm install
npm start
```
Frontend runs at `http://localhost:3000`.

---

## Demo Flow
1. **Enter Panel Details**: Installation date, dust density, number of panels, ideal generation (kWh/d per panel), tilt.
2. **Run Analysis**: See live weather, predicted losses, and recommendations.
3. **View History**: Explore past performance and cleaning impact.
4. **Receive Alerts**: Get notified when action is needed.

---

## Troubleshooting & Notes
- **Unit Consistency**: Enter ideal panel generation as daily kWh per panel. The app converts this to kW for model input.
- **Model**: The backend uses an ONNX model for all predictions. If results seem off, check the model file in `backend/ml_training/saved_model/`.
- **Offline Mode**: If the backend is down, the app will use offline heuristics for predictions.
- **Logs**: Backend logs warnings if model predictions are out of range or capped.

---

## Hackathon Talking Points
- End-to-end solution: From data input to actionable advice.
- AI-driven: Real machine learning, not just heuristics.
- Robust: Handles errors, offline mode, and edge cases gracefully.
- Future: Can integrate with IoT hardware or mobile apps for even more automation.

---

## Authors
- Pratyush Ranjan Das and team

---


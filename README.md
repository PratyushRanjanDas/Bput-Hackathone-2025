# Solar Panel Optimizer

This project is a full-stack web application designed to monitor and optimize the performance of solar panels. It features a React frontend and a Python Flask backend.

## Project Structure

-   `/frontend`: Contains the React application that provides the user interface.
-   `/backend`: Contains the Flask server that provides the API for live data and predictions.
-   `/backend/ml_training`: Contains the scripts used to train the machine learning models.

### Detailed Project Structure

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
│   │   │   └── loss_prediction_model.onnx
│   │   └── scripts
│   │       ├── 1_simulate_historical_data.py
│   │       ├── 1b_simulate_loss_data.py
│   │       ├── 2_train_model.py
│   │       ├── 2b_train_loss_model.py
│   │       └── 3_convert_model_to_onnx.py
│   ├── services
│   │   ├── __init__.py
│   │   └── recommendation_service.py
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   └── requirements.txt
├── frontend
│   ├── build
│   │   └── ... (build artifacts)
│   ├── public
│   │   ├── index.html
│   │   ├── loss_prediction_model.onnx
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src
│   │   ├── components
│   │   │   ├── HistoryGraph.js
│   │   │   ├── RecommendationCard.js
│   │   │   └── StatusPanel.js
│   │   ├── services
│   │   │   ├── historyService.js
│   │   │   ├── offlineRecommendationService.js
│   │   │   └── onlineRecommendationService.js
│   │   ├── App.css
│   │   ├── App.js
│   │   ├── App.test.js
│   │   ├── index.css
│   │   ├── index.js
│   │   ├── reportWebVitals.js
│   │   └── setupTests.js
│   └── package.json
└── README.md
```

## How to Run the Project

To run this project, you will need to have two terminals open simultaneously.

### 1. Run the Backend Server

In your first terminal, navigate to the backend directory, install the dependencies, and start the Flask server:

```bash
cd backend
pip install -r requirements.txt
python3 app.py
```

The backend server will start on `http://127.0.0.1:5001`.

### 2. Run the Frontend Application

In your second terminal, navigate to the frontend directory, install the dependencies, and start the React development server:

```bash
cd frontend
npm install
npm start
```

The frontend application will open automatically in your browser at `http://localhost:3000`.


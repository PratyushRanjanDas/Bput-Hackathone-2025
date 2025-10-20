# /Users/pratyushranjandas/code/BPUT-Hackathon(2025)_solar-panel-optimizer/backend/config.py

"""
Configuration settings for the Solar Panel Optimizer application.
"""

# --- Business Logic Configuration ---

# Cost to have a professional clean the solar panels.
# This value is in Indian Rupees (INR).
CLEANING_COST = 2000

# The monetary value of 1 kilowatt-hour (kWh) of generated electricity.
# This is used to calculate the financial impact of energy loss.
# This value is in Indian Rupees (INR).
ENERGY_VALUE_PER_KWH = 7

# --- Recommendation Engine Thresholds ---

# The daily financial loss (in INR) that will trigger a cleaning recommendation.
# If the estimated daily loss exceeds this value, the system will suggest
# that the user should clean the panels.
RECOMMENDATION_THRESHOLD_INR = 20

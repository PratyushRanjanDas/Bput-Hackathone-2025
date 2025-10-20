import sqlite3
import os

def get_db_connection():
    """Establishes a connection to the database."""
    db_path = os.path.join(os.path.dirname(__file__), 'data', 'history.db')
    conn = sqlite3.connect(db_path)
    # This makes the output like a dictionary, which is easier to work with
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Initializes the database and creates the prediction_history table 
    if it doesn't already exist.
    """
    # Define the path for the database file inside the 'data' directory
    db_path = os.path.join(os.path.dirname(__file__), 'data', 'history.db')
    
    # Ensure the 'data' directory exists before creating the database file
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create the table as per our plan
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prediction_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            predicted_loss REAL NOT NULL,
            financial_loss REAL NOT NULL,
            action_required BOOLEAN NOT NULL
        )
    ''')
    
    print("Database initialized successfully.")
    conn.commit()
    conn.close()

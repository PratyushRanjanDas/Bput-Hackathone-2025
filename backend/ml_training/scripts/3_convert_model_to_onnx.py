import joblib
import skl2onnx
import onnx
from skl2onnx.common.data_types import FloatTensorType
import numpy as np
import os

def convert_to_onnx():
    """
    Loads the trained .pkl model and converts it to .onnx format
    for use in the browser.
    """
    print("Starting model conversion to ONNX...")

    # Define paths
    script_dir = os.path.dirname(__file__)
    model_dir = os.path.join(script_dir, '..', 'saved_model')
    pkl_model_path = os.path.join(model_dir, 'loss_prediction_model.pkl')
    onnx_model_path = os.path.join(model_dir, 'loss_prediction_model.onnx')

    # 1. Load the scikit-learn model
    try:
        model = joblib.load(pkl_model_path)
        print("Pickled model loaded successfully.")
    except FileNotFoundError:
        print(f"Error: Model file not found at {pkl_model_path}")
        return

    # 2. Define the input shape for the model
    # Our model expects 6 features: ['temperature_celsius', 'cloud_cover_percentage', 
    # 'panel_age_in_days', 'days_since_cleaning', 'hour', 'day_of_year']
    # The shape is [None, 6], which means a variable number of inputs (batch size), each with 6 features.
    initial_type = [('float_input', FloatTensorType([None, 6]))]

    # 3. Convert the model
    print("Converting model to ONNX format...")
    onnx_model = skl2onnx.convert_sklearn(model, initial_types=initial_type)

    # 4. Save the ONNX model
    with open(onnx_model_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    
    print(f"Conversion successful. ONNX model saved to: {os.path.abspath(onnx_model_path)}")

if __name__ == '__main__':
    convert_to_onnx()
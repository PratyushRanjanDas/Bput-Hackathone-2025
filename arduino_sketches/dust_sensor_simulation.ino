/*
  Dust Sensor Simulation for Solar Panel Optimizer

  This sketch simulates reading data from a Sharp GP2Y1010AU0F Optical Dust Sensor
  and sends the data over the serial port in a simple JSON format.

  In a real-world scenario, you would connect the sensor to an analog pin and
  perform a reading sequence as per the sensor's datasheet. For this simulation,
  we will just generate random values to demonstrate the communication.

  Hardware:
  - Arduino Board (Uno, Nano, etc.)
  - (Optional) Sharp GP2Y1010AU0F Dust Sensor

  If using a real sensor, connections would be:
  - V-LED -> 5V (with a 150 Ohm resistor)
  - LED-GND -> GND
  - S-GND -> GND
  - Vcc -> 5V
  - Vo -> Arduino Analog Pin (e.g., A0)
*/

// Pin for the sensor's analog output (if a real sensor was connected)
const int dustSensorPin = A0; 

void setup() {
  // Start the serial communication at a standard baud rate
  Serial.begin(9600);
  
  // Set up the pin mode for the sensor
  pinMode(dustSensorPin, INPUT);

  // A brief delay to allow the serial monitor to connect
  delay(1000); 
  Serial.println("Arduino Dust Sensor Simulator Initialized.");
  Serial.println("Sending simulated dust density data every 5 seconds...");
}

void loop() {
  // --- SIMULATION LOGIC ---
  // In a real scenario, you would read the voltage from the sensor here.
  // float dustVoltage = analogRead(dustSensorPin) * (5.0 / 1024.0);
  // float dustDensity = 0.17 * dustVoltage - 0.1; // Formula from datasheet
  
  // For simulation, we generate a random value.
  // Let's simulate a dust density value between 0.01 (clean) and 0.50 (dusty) mg/m^3
  float simulatedDustDensity = random(1, 51) / 100.0;

  // Create a simple JSON-like string to send
  // Using JSON makes it easy for the JavaScript frontend to parse.
  String jsonString = "{\"dustDensity_mg_m3\": " + String(simulatedDustDensity, 2) + "}";

  // Send the data over the serial port
  Serial.println(jsonString);

  // Wait for 5 seconds before sending the next reading
  delay(5000);
}

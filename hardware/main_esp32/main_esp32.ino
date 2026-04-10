#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <TFT_eSPI.h>
#include <qrcode.h>

// PIN DEFINITIONS
#define BTN_QR_PIN       32
#define PIR_PIN          33
#define RELAY_LIGHT_PIN  25
#define RELAY_FAN_PIN    26
#define SERVO_1_PIN      12
#define SERVO_2_PIN      13
#define SERVO_3_PIN      14

// STATE & TIMERS
bool hasActiveBooking = false;
unsigned long bookingEndTime = 0; // in Unix timestamp (would need NTP) or relative millis
unsigned long startMillis;
unsigned long durationMillis = 0;

// HARDWARE OBJECTS
TFT_eSPI tft = TFT_eSPI();
Servo servo1;
Servo servo2;
Servo servo3;

// MQTT SETUP (For Web App <-> Server <-> ESP32 communication)
const char* mqtt_server = "broker.hivemq.com";
const char* mqtt_topic_in = "courtkings/court_1/cmd";
const char* mqtt_topic_out = "courtkings/court_1/status";
WiFiClient espClient;
PubSubClient client(espClient);

// UTILS
String generateRandomToken() {
  return "COURT_1_TOKEN_" + String(random(10000, 99999));
}

String currentQRToken = "";

void displayQRCode(String text) {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE);
  tft.drawString("QUET MA DE CHECK-IN", 10, 10, 2);

  // Generate QR Code
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(3)];
  qrcode_initText(&qrcode, qrcodeData, 3, 0, text.c_str());

  int scale = 4; // Scale size
  int startX = (tft.width() - qrcode.size * scale) / 2;
  int startY = 40;

  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        tft.fillRect(startX + x * scale, startY + y * scale, scale, scale, TFT_WHITE);
      } else {
        tft.fillRect(startX + x * scale, startY + y * scale, scale, scale, TFT_BLACK);
      }
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize Pins
  pinMode(BTN_QR_PIN, INPUT_PULLUP);
  pinMode(PIR_PIN, INPUT);
  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  pinMode(RELAY_FAN_PIN, OUTPUT);
  
  digitalWrite(RELAY_LIGHT_PIN, LOW); // OFF
  digitalWrite(RELAY_FAN_PIN, LOW);   // OFF

  // Attach Servos
  servo1.attach(SERVO_1_PIN);
  servo2.attach(SERVO_2_PIN);
  servo3.attach(SERVO_3_PIN);
  closeDoors();

  // Init TFT
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE);
  tft.drawString("Khai dong...", 10, 10, 2);

  // WiFiManager
  WiFiManager wm;
  if (!wm.autoConnect("CourtKings_ESP32", "12345678")) {
    Serial.println("Failed to connect to WiFi");
    ESP.restart();
  }
  
  tft.fillScreen(TFT_BLACK);
  tft.drawString("San sang hoat dong", 10, 10, 2);

  // MQTT
  client.setServer(mqtt_server, 1883);
  client.setCallback(mqttCallback);
}

void loop() {
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  // Button Press -> Show QR Code
  if (digitalRead(BTN_QR_PIN) == LOW) {
    currentQRToken = generateRandomToken();
    displayQRCode(currentQRToken);
    
    // Send to backend that this token is now active for this court
    String msg = "{\"event\": \"QR_GENERATED\", \"token\": \"" + currentQRToken + "\"}";
    client.publish(mqtt_topic_out, msg.c_str());
    
    delay(500); // debounce
  }

  // Motion Sensor (PIR) logic (Optional: Auto turn off light if no motion during booking)
  if (hasActiveBooking) {
    if (millis() - startMillis >= durationMillis) {
      endBooking();
    }
  }
}

void openDoors() {
  servo1.write(90); // Open position
  servo2.write(90);
  servo3.write(90);
  delay(5000); // Open for 5 seconds
}

void closeDoors() {
  servo1.write(0); // Closed position
  servo2.write(0);
  servo3.write(0);
}

void endBooking() {
  hasActiveBooking = false;
  digitalWrite(RELAY_LIGHT_PIN, LOW);
  digitalWrite(RELAY_FAN_PIN, LOW);
  closeDoors();
  tft.fillScreen(TFT_BLACK);
  tft.drawString("Booking Finished.", 10, 10, 2);
  client.publish(mqtt_topic_out, "{\"event\": \"BOOKING_ENDED\"}");
}

// Handle Commands from Server/Web App
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println("Received: " + message);

  // Check commands
  // JSON parsing ideally using ArduinoJson
  if (message.indexOf("BOOKING_VALIDATED") >= 0) {
    // Backend validated the QR scan
    hasActiveBooking = true;
    startMillis = millis();
    durationMillis = 3600000; // Example: 1 Hour (in ms)
    
    openDoors();
    tft.fillScreen(TFT_BLACK);
    tft.drawString("Chao mung! San da mo.", 10, 10, 2);
  }

  if (hasActiveBooking) {
    if (message.indexOf("TOGGLE_LIGHT_ON") >= 0) digitalWrite(RELAY_LIGHT_PIN, HIGH);
    if (message.indexOf("TOGGLE_LIGHT_OFF") >= 0) digitalWrite(RELAY_LIGHT_PIN, LOW);
    if (message.indexOf("TOGGLE_FAN_ON") >= 0) digitalWrite(RELAY_FAN_PIN, HIGH);
    if (message.indexOf("TOGGLE_FAN_OFF") >= 0) digitalWrite(RELAY_FAN_PIN, LOW);
    if (message.indexOf("OPEN_DOORS") >= 0) {
      openDoors();
      delay(5000); // keep open for a few sec then close
      closeDoors();
    }
  }
}

void reconnectMQTT() {
  while (!client.connected()) {
    if (client.connect("ESP32Client_Court1")) {
      client.subscribe(mqtt_topic_in);
    } else {
      delay(2000);
    }
  }
}

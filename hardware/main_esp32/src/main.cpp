#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <TFT_eSPI.h>
#include <qrcode.h>

// ============ CẤU HÌNH CHÂN ============
#define RELAY_LIGHT_PIN  25
#define RELAY_FAN_PIN    26
#define SERVO_PIN        12

// ============ MQTT ============
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port   = 1883;

// ============ HARDWARE ============
TFT_eSPI tft = TFT_eSPI();
Servo doorServo;
WiFiClient espClient;
PubSubClient mqtt(espClient);

// ============ TRẠNG THÁI ============
String currentQRToken = "";
bool lightOn = false;
bool fanOn   = false;

// ============ TẠO MÃ TOKEN ============
String generateToken() {
  // App check-in yêu cầu mã bắt đầu bằng "COURT01" hoặc "COURT_"
  return "COURT01_" + String(random(1000, 9999));
}

// ============ HIỂN THỊ TRẠNG THÁI KHỞI ĐỘNG ============
void showStatus(const char* line1, const char* line2 = "", uint16_t color = TFT_WHITE) {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(color);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(line1, tft.width()/2, tft.height()/2 - 10, 2);
  if (strlen(line2) > 0) {
    tft.setTextColor(TFT_DARKGREY);
    tft.drawString(line2, tft.width()/2, tft.height()/2 + 15, 2);
  }
}

// ============ HIỂN THỊ MÃ QR ============
void displayQRCode(String text) {
  tft.fillScreen(TFT_BLACK);

  // Tiêu đề
  tft.setTextColor(TFT_ORANGE);
  tft.setTextDatum(TC_DATUM);
  tft.drawString("QUET MA DE CHECK-IN", tft.width()/2, 5, 2);

  // Tạo mã QR (version 3 = 29x29 modules)
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(3)];
  qrcode_initText(&qrcode, qrcodeData, 3, 0, text.c_str());

  // Tính scale cho màn hình 240x240, chừa header 25px
  int availableHeight = tft.height() - 30;
  int scale = availableHeight / qrcode.size;
  if (scale < 1) scale = 1;

  int startX = (tft.width()  - qrcode.size * scale) / 2;
  int startY = 28 + (availableHeight - qrcode.size * scale) / 2;

  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      uint16_t color = qrcode_getModule(&qrcode, x, y) ? TFT_WHITE : TFT_BLACK;
      tft.fillRect(startX + x * scale, startY + y * scale, scale, scale, color);
    }
  }

  // Footer nhỏ
  tft.setTextColor(TFT_DARKGREY);
  tft.setTextDatum(BC_DATUM);
  tft.drawString(text.c_str(), tft.width()/2, tft.height() - 2, 1);
}

// ============ ĐIỀU KHIỂN CỬA ============
void openDoor() {
  Serial.println("[DOOR] Opening...");
  doorServo.write(90);

  tft.fillScreen(TFT_DARKGREEN);
  tft.setTextColor(TFT_WHITE);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("CUA DA MO!", tft.width()/2, tft.height()/2 - 10, 4);
  tft.setTextColor(TFT_LIGHTGREY);
  tft.drawString("Tu dong dong sau 5s", tft.width()/2, tft.height()/2 + 25, 2);

  delay(5000);

  Serial.println("[DOOR] Closing...");
  doorServo.write(0);

  // Quay lại hiển thị QR
  displayQRCode(currentQRToken);
}

void closeDoor() {
  Serial.println("[DOOR] Force closing...");
  doorServo.write(0);
}

// ============ MQTT CALLBACK ============
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  String topicStr = String(topic);
  Serial.printf("[MQTT] %s -> %s\n", topic, message.c_str());

  // Topic: court/1/open  (từ Checkin.tsx & Control.tsx)
  if (topicStr == "court/1/open") {
    if (message == "OPEN") {
      openDoor();
    } else if (message == "CLOSE") {
      closeDoor();
    }
  }

  // Topic: court/1/light (từ Control.tsx)
  if (topicStr == "court/1/light") {
    if (message == "ON") {
      digitalWrite(RELAY_LIGHT_PIN, HIGH);
      lightOn = true;
      Serial.println("[RELAY] Light ON");
    } else if (message == "OFF") {
      digitalWrite(RELAY_LIGHT_PIN, LOW);
      lightOn = false;
      Serial.println("[RELAY] Light OFF");
    }
  }

  // Topic: court/1/fan (từ Control.tsx)
  if (topicStr == "court/1/fan") {
    if (message == "ON") {
      digitalWrite(RELAY_FAN_PIN, HIGH);
      fanOn = true;
      Serial.println("[RELAY] Fan ON");
    } else if (message == "OFF") {
      digitalWrite(RELAY_FAN_PIN, LOW);
      fanOn = false;
      Serial.println("[RELAY] Fan OFF");
    }
  }
}

// ============ KẾT NỐI LẠI MQTT ============
void reconnectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting...");
    String clientId = "ESP32_Court1_" + String(random(0xFFFF), HEX);

    if (mqtt.connect(clientId.c_str())) {
      Serial.println(" OK");
      mqtt.subscribe("court/1/open");
      mqtt.subscribe("court/1/light");
      mqtt.subscribe("court/1/fan");
      Serial.println("[MQTT] Subscribed to court/1/*");
    } else {
      Serial.printf(" FAIL (rc=%d), retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

// ============ SETUP ============
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== HE THONG QUAN LY SAN BONG RO ===");

  // --- Relay ---
  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  pinMode(RELAY_FAN_PIN, OUTPUT);
  digitalWrite(RELAY_LIGHT_PIN, LOW);
  digitalWrite(RELAY_FAN_PIN, LOW);

  // --- Servo ---
  doorServo.attach(SERVO_PIN);
  doorServo.write(0); // Khóa ban đầu

  // --- TFT ---
  tft.init();
  tft.setRotation(0); // 240x240 portrait
  tft.fillScreen(TFT_BLACK);
  showStatus("Dang khoi dong...", "WiFiManager");

  // --- WiFiManager ---
  WiFiManager wm;
  wm.setConfigPortalTimeout(180); // 3 phút timeout
  // Khi chưa có WiFi, ESP32 sẽ phát AP "SanBongRo_Setup"
  // Người dùng kết nối vào AP này rồi vào 192.168.4.1 để nhập WiFi
  bool connected = wm.autoConnect("SanBongRo_Setup", "12345678");

  if (!connected) {
    showStatus("WiFi THAT BAI!", "Dang khoi dong lai...", TFT_RED);
    Serial.println("[WIFI] Failed! Restarting...");
    delay(3000);
    ESP.restart();
  }

  Serial.print("[WIFI] Connected! IP: ");
  Serial.println(WiFi.localIP());
  showStatus("WiFi OK!", WiFi.localIP().toString().c_str(), TFT_GREEN);
  delay(1500);

  // --- MQTT ---
  mqtt.setServer(mqtt_server, mqtt_port);
  mqtt.setCallback(mqttCallback);

  // --- QR Token ---
  currentQRToken = generateToken();
  Serial.printf("[QR] Token: %s\n", currentQRToken.c_str());

  // Hiển thị QR Code lên màn hình
  displayQRCode(currentQRToken);
}

// ============ LOOP ============
void loop() {
  // Giữ kết nối MQTT
  if (!mqtt.connected()) {
    reconnectMQTT();
  }
  mqtt.loop();
}

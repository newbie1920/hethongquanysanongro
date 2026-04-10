import mqtt from 'mqtt';

const brokerUrl = import.meta.env.VITE_MQTT_BROKER_URL || 'wss://broker.emqx.io:8084/mqtt';
const username = import.meta.env.VITE_MQTT_USERNAME;
const password = import.meta.env.VITE_MQTT_PASSWORD;

const options: mqtt.IClientOptions = {
  keepalive: 60,
  clientId: `web_client_${Math.random().toString(16).slice(3)}`,
  protocolId: 'MQTT',
  protocolVersion: 4,
  clean: true,
  reconnectPeriod: 1000,
  connectTimeout: 30 * 1000,
};

if (username) options.username = username;
if (password) options.password = password;

export const mqttClient = mqtt.connect(brokerUrl, options);

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});

mqttClient.on('error', (err) => {
  console.error('MQTT connection error:', err);
});

export const publishMessage = (topic: string, message: string) => {
  if (mqttClient.connected) {
    mqttClient.publish(topic, message);
  } else {
    console.warn('MQTT client not connected. Cannot publish:', topic, message);
  }
};

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) UNIQUE,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  barber_name VARCHAR(100),
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending',
  status VARCHAR(20) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS conversation_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) UNIQUE,
  state VARCHAR(50) DEFAULT 'idle',
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100),
  role VARCHAR(20),
  message TEXT,
  intent TEXT,
  entities JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

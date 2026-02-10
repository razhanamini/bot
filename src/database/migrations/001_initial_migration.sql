-- Create tables
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_days INTEGER NOT NULL,
    data_limit_gb DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    receipt_photo TEXT,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    card_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    admin_message_id BIGINT,
    admin_chat_id BIGINT
);

CREATE TABLE user_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    vless_link TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_used_gb DECIMAL(10, 2) DEFAULT 0.00,
    client_email VARCHAR(255),
    inbound_tag VARCHAR(100),
    data_limit_gb DECIMAL(10, 2)
);

-- Create indexes
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_user_configs_user_id ON user_configs(user_id);
CREATE INDEX idx_user_configs_status ON user_configs(status);
CREATE INDEX idx_user_configs_expires_at ON user_configs(expires_at);

-- Insert sample services
INSERT INTO services (name, description, price, duration_days, data_limit_gb, is_active) VALUES
('Basic Plan', '1 month V2Ray config with 100GB data', 9.99, 30, 100, true),
('Standard Plan', '3 months V2Ray config with 300GB data', 24.99, 90, 300, true),
('Premium Plan', '6 months V2Ray config with 1TB data', 44.99, 180, 1024, true),
('Unlimited Plan', '1 year unlimited V2Ray config', 79.99, 365, NULL, true);
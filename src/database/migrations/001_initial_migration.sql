-- =====================================================
-- V2Ray Telegram Bot - Complete Database Schema
-- =====================================================

-- Drop tables if they exist (for clean installation)
DROP TABLE IF EXISTS user_configs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS user_configs CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS servers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Additional user info
    language_code VARCHAR(10) DEFAULT 'en',
    total_purchases DECIMAL(10, 2) DEFAULT 0.00,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_balance ON users(balance);

-- =====================================================
-- 2. SERVERS TABLE
-- =====================================================
CREATE TABLE servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    ip VARCHAR(50) NOT NULL,
    api_port INTEGER NOT NULL DEFAULT 5000,
    xray_port INTEGER NOT NULL DEFAULT 8445,
    api_token VARCHAR(255) NOT NULL,
    max_users INTEGER NOT NULL DEFAULT 100,
    current_users INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_checked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    -- Server specifications
    cpu_cores INTEGER DEFAULT 2,
    ram_gb INTEGER DEFAULT 4,
    bandwidth_limit_gb INTEGER,
    monthly_cost DECIMAL(10, 2),
    notes TEXT,
    
    -- Constraints
    CONSTRAINT check_server_status CHECK (status IN ('active', 'maintenance', 'offline', 'decommissioned')),
    CONSTRAINT check_current_users CHECK (current_users >= 0 AND current_users <= max_users)
);

-- Indexes for servers
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_servers_location ON servers(location);
CREATE INDEX idx_servers_current_users ON servers(current_users);
CREATE INDEX idx_servers_is_active ON servers(is_active);

-- =====================================================
-- 3. SERVICES TABLE (Plans/Packages)
-- =====================================================
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_days INTEGER NOT NULL,
    data_limit_gb DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional service details
    speed_limit_mbps INTEGER,
    concurrent_connections INTEGER DEFAULT 1,
    priority_level INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT check_price_positive CHECK (price >= 0),
    CONSTRAINT check_duration_positive CHECK (duration_days > 0),
    CONSTRAINT check_data_limit_positive CHECK (data_limit_gb IS NULL OR data_limit_gb > 0)
);

-- Indexes for services
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_price ON services(price);
CREATE INDEX idx_services_sort_order ON services(sort_order);

-- =====================================================
-- 4. USER_CONFIGS TABLE (Active Services)
-- =====================================================
CREATE TABLE user_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
    vless_link TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_used_gb DECIMAL(10, 2) DEFAULT 0.00,
    client_email VARCHAR(255),
    inbound_tag VARCHAR(100),
    data_limit_gb DECIMAL(10, 2),
    
    -- Additional config info
    port INTEGER,
    protocol VARCHAR(50) DEFAULT 'vless',
    security VARCHAR(50) DEFAULT 'reality',
    network VARCHAR(50) DEFAULT 'tcp',
    last_connected_at TIMESTAMP WITH TIME ZONE,
    total_connections INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT check_status CHECK (status IN ('active', 'test', 'suspended', 'expired', 'cancelled')),
    CONSTRAINT check_data_used_positive CHECK (data_used_gb >= 0),
    CONSTRAINT check_expires_at_future CHECK (expires_at > created_at)
    
    -- Prevent duplicate active services for same user+email+server
    -- CONSTRAINT unique_active_user_service UNIQUE (user_id, client_email, server_id, status) 
    --     WHERE status IN ('active', 'test')
);

-- Indexes for user_configs
CREATE INDEX idx_user_configs_user_id ON user_configs(user_id);
CREATE INDEX idx_user_configs_server_id ON user_configs(server_id);
CREATE INDEX idx_user_configs_service_id ON user_configs(service_id);
CREATE INDEX idx_user_configs_status ON user_configs(status);
CREATE INDEX idx_user_configs_expires_at ON user_configs(expires_at);
CREATE INDEX idx_user_configs_client_email ON user_configs(client_email);
CREATE INDEX idx_user_configs_created_at ON user_configs(created_at);
CREATE INDEX idx_user_configs_composite ON user_configs(user_id, status, expires_at);

-- =====================================================
-- 5. PAYMENTS TABLE
-- =====================================================
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    receipt_photo TEXT,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    card_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    admin_message_id BIGINT,
    admin_chat_id BIGINT,
    
    -- Additional payment info
    payment_method VARCHAR(50) DEFAULT 'card',
    confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    user_config_id INTEGER REFERENCES user_configs(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT check_amount_positive CHECK (amount > 0),
    CONSTRAINT check_payment_status CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'refunded'))
);

-- Indexes for payments
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_invoice_number ON payments(invoice_number);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_composite ON payments(user_id, status, created_at);

-- =====================================================
-- 6. USAGE_HISTORY TABLE (Track bandwidth usage over time)
-- =====================================================
CREATE TABLE usage_history (
    id SERIAL PRIMARY KEY,
    user_config_id INTEGER REFERENCES user_configs(id) ON DELETE CASCADE,
    server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uplink_bytes BIGINT DEFAULT 0,
    downlink_bytes BIGINT DEFAULT 0,
    total_bytes BIGINT DEFAULT 0,
    uplink_gb DECIMAL(10, 2) GENERATED ALWAYS AS (uplink_bytes / 1073741824.0) STORED,
    downlink_gb DECIMAL(10, 2) GENERATED ALWAYS AS (downlink_bytes / 1073741824.0) STORED,
    total_gb DECIMAL(10, 2) GENERATED ALWAYS AS ((uplink_bytes + downlink_bytes) / 1073741824.0) STORED
);

-- Indexes for usage_history
CREATE INDEX idx_usage_history_user_config_id ON usage_history(user_config_id);
CREATE INDEX idx_usage_history_server_id ON usage_history(server_id);
CREATE INDEX idx_usage_history_recorded_at ON usage_history(recorded_at);
CREATE INDEX idx_usage_history_composite ON usage_history(user_config_id, recorded_at DESC);

-- =====================================================
-- 7. SERVER_LOGS TABLE (Track server operations)
-- =====================================================
CREATE TABLE server_logs (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_config_id INTEGER REFERENCES user_configs(id) ON DELETE SET NULL,
    
    CONSTRAINT check_event_type CHECK (event_type IN (
        'config_update', 'restart', 'user_added', 'user_removed', 
        'status_change', 'error', 'health_check'
    ))
);

-- Indexes for server_logs
CREATE INDEX idx_server_logs_server_id ON server_logs(server_id);
CREATE INDEX idx_server_logs_created_at ON server_logs(created_at);
CREATE INDEX idx_server_logs_event_type ON server_logs(event_type);

-- =====================================================
-- 8. VIEWS
-- =====================================================

-- Server status view with availability
CREATE OR REPLACE VIEW v_server_status AS
SELECT 
    s.*,
    (s.max_users - s.current_users) as available_slots,
    ROUND((s.current_users::DECIMAL / NULLIF(s.max_users, 0) * 100), 1) as utilization_percent,
    CASE 
        WHEN s.current_users >= s.max_users THEN 'full'
        WHEN s.status != 'active' THEN s.status
        ELSE 'available'
    END as availability,
    CASE 
        WHEN s.last_checked_at IS NULL THEN 'unknown'
        WHEN NOW() - s.last_checked_at < INTERVAL '5 minutes' THEN 'healthy'
        WHEN NOW() - s.last_checked_at < INTERVAL '15 minutes' THEN 'degraded'
        ELSE 'offline'
    END as health_status
FROM servers s
WHERE s.is_active = true;

-- User summary view
CREATE OR REPLACE VIEW v_user_summary AS
SELECT 
    u.id,
    u.telegram_id,
    u.username,
    u.balance,
    COUNT(uc.id) FILTER (WHERE uc.status = 'active') as active_services,
    COUNT(uc.id) FILTER (WHERE uc.status = 'test') as test_services,
    COUNT(uc.id) as total_services,
    -- SUM(uc.data_used_gb) FILTER (WHERE uc.status = 'active') as total_data_used_gb,
    -- SUM(uc.data_limit_gb) FILTER (WHERE uc.status = 'active') as total_data_limit_gb,
    SUM(uc.data_used_gb) FILTER (WHERE uc.status IN ('active', 'test')) as total_data_used_gb,
    SUM(uc.data_limit_gb) FILTER (WHERE uc.status IN ('active', 'test')) as total_data_limit_gb,
    MAX(uc.expires_at) FILTER (WHERE uc.status = 'active') as next_expiry,
    SUM(p.amount) FILTER (WHERE p.status = 'confirmed') as total_spent,
    COUNT(p.id) FILTER (WHERE p.status = 'confirmed') as total_payments,
    u.created_at as registered_at,
    u.last_seen_at
FROM users u
LEFT JOIN user_configs uc ON u.id = uc.user_id
LEFT JOIN payments p ON u.id = p.user_id
GROUP BY u.id, u.telegram_id, u.username, u.balance, u.created_at, u.last_seen_at;

-- Service revenue view
CREATE OR REPLACE VIEW v_service_revenue AS
SELECT 
    s.id,
    s.name,
    s.price,
    s.duration_days,
    COUNT(uc.id) as total_sales,
    COUNT(uc.id) FILTER (WHERE uc.status = 'active') as active_sales,
    SUM(s.price) as total_revenue,
    AVG(uc.data_used_gb) as avg_data_usage_gb,
    SUM(uc.data_used_gb) as total_data_usage_gb
FROM services s
LEFT JOIN user_configs uc ON s.id = uc.service_id
WHERE s.is_active = true
GROUP BY s.id, s.name, s.price, s.duration_days
ORDER BY total_sales DESC;

-- =====================================================
-- 9. INITIAL DATA
-- =====================================================

-- Insert sample services
-- INSERT INTO services (name, description, price, duration_days, data_limit_gb, is_active, sort_order) VALUES
-- ('Basic Plan', '1 month V2Ray config with 100GB data', 10, 30, 100, true, 1),
-- ('Standard Plan', '3 months V2Ray config with 300GB data', 20, 90, 300, true, 2),
-- ('Premium Plan', '6 months V2Ray config with 1TB data', 30, 180, 1024, true, 3),
-- ('Unlimited Plan', '1 year unlimited V2Ray config', 70, 365, NULL, true, 4),
-- ('Test Plan', '1 day V2Ray config with 1GB data', 1, 1, 1, true, 5),
-- (999, 'Free Test', '24 hour test service with 200MB data', 0, 1, 0.2, true, 0);

-- INSERT INTO services (id, name, description, price, duration_days, data_limit_gb, is_active, sort_order) VALUES
-- (1, 'Basic Plan', '1 month V2Ray config with 100GB data', 10, 30, 100, true, 1),
-- (2, 'Standard Plan', '3 months V2Ray config with 300GB data', 20, 90, 300, true, 2),
-- (3, 'Premium Plan', '6 months V2Ray config with 1TB data', 30, 180, 1024, true, 3),
-- (4, 'Unlimited Plan', '1 year unlimited V2Ray config', 70, 365, NULL, true, 4),
-- (5, 'Test Plan', '1 day V2Ray config with 1GB data', 1, 1, 1, true, 5),
-- (1111, 'Free Test', '24 hour test service with 200MB data', 0, 1, 0.2, true, 0);
INSERT INTO services (id, name, description, price, duration_days, data_limit_gb, is_active, sort_order) VALUES
(1, 'پلن پایه', ' چند کاربره یک ماهه  25 گیگابایت ', 170000, 30, 25, true, 1),
(2, 'پلن استاندارد', 'چند کاربره  یک ماهه 50 گیگابایت ', 230000, 30, 50, true, 2),
(3, 'پلن پریمیوم', 'چند کاربره  یک ماهه  150 گیگابایت ', 300000, 30, 100, true, 3),
(4, 'پلن نامحدود', ' چند کاربره یک ماهه  200 گیگابایت ', 365000, 30, 150, true, 4),
(4, 'پلن نامحدود', ' چند کاربره یک ماهه  200 گیگابایت ', 9999, 30, 0.1, true, 5),
(1111, 'تست رایگان', 'سرویس تست 24 ساعته  200 مگابایت ', 0, 1, 0.2, true, 0);

-- Insert initial servers (update tokens before running)

INSERT INTO servers (
    name, domain, ip, api_port, api_token, max_users, 
    current_users, location, status, cpu_cores, ram_gb, xray_port
) VALUES
('Frankfurt-1', 'de-v1-gwez.gemminie.xyz', '172.86.68.124', 5000, 'BviUVBkhZH2YdydyGiREet3f8vfWyEpGi5i2ozwOsGPVlXD6KKvxkXkXZ063mQV8', 250, 0, 'Germany', 'active', 1, 1,8445);
-- =====================================================
-- 10. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update user's last_seen_at
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET last_seen_at = NOW() 
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_configs updates
CREATE TRIGGER trigger_update_user_last_seen
    AFTER INSERT OR UPDATE ON user_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_user_last_seen();

-- Function to record server changes in logs
CREATE OR REPLACE FUNCTION log_server_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO server_logs (server_id, event_type, message, user_config_id)
    VALUES (
        NEW.server_id,
        TG_ARGV[0]::text,
        TG_ARGV[1]::text,
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user added to server
CREATE TRIGGER trigger_log_user_added
    AFTER INSERT ON user_configs
    FOR EACH ROW
    WHEN (NEW.server_id IS NOT NULL)
    EXECUTE FUNCTION log_server_event('user_added', 'User config created');

-- Trigger for user removed from server
CREATE TRIGGER trigger_log_user_removed
    AFTER UPDATE OF status ON user_configs
    FOR EACH ROW
    WHEN (OLD.status = 'active' AND NEW.status IN ('suspended', 'expired', 'cancelled'))
    EXECUTE FUNCTION log_server_event('user_removed', 'User removed from server');

-- =====================================================
-- 11. COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE users IS 'Telegram bot users';
COMMENT ON TABLE servers IS 'V2Ray/XRay server instances';
COMMENT ON TABLE services IS 'Available service plans';
COMMENT ON TABLE user_configs IS 'Active user configurations';
COMMENT ON TABLE payments IS 'Payment transactions';
COMMENT ON TABLE usage_history IS 'Bandwidth usage history';
COMMENT ON TABLE server_logs IS 'Server operation logs';

COMMENT ON COLUMN servers.max_users IS 'Maximum number of users this server can handle';
COMMENT ON COLUMN servers.current_users IS 'Current number of active users on this server';
COMMENT ON COLUMN servers.api_token IS 'API authentication token for this server';
COMMENT ON COLUMN user_configs.data_limit_gb IS 'Data limit in GB (NULL = unlimited)';
COMMENT ON COLUMN user_configs.client_email IS 'User email for identification in Xray config';
COMMENT ON COLUMN payments.invoice_number IS 'Unique invoice identifier';
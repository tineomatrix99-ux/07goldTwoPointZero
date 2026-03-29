-- SQL Script for 07gold Admin Account Setup

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Admin Account
INSERT INTO users (username, password, role) 
VALUES ('07gold', '123', 'admin');

-- Market Rates Table (For cloud persistence)
CREATE TABLE IF NOT EXISTS market_rates (
    id INT PRIMARY KEY DEFAULT 1,
    buy_rate FLOAT NOT NULL,
    sell_rate FLOAT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize with default rates
INSERT INTO market_rates (id, buy_rate, sell_rate) 
VALUES (1, 0.35, 0.31)
ON CONFLICT (id) DO NOTHING;

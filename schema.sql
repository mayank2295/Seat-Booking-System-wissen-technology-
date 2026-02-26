CREATE DATABASE IF NOT EXISTS seat_booking;
USE seat_booking;

-- ============================================
-- Users table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  batch TINYINT NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Seats table (no type distinction — all 50 are generic physical seats)
-- ============================================
CREATE TABLE IF NOT EXISTS seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seat_number VARCHAR(10) NOT NULL UNIQUE
);

-- ============================================
-- Bookings table
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  seat_id INT NOT NULL,
  booking_date DATE NOT NULL,
  status ENUM('booked', 'cancelled') DEFAULT 'booked',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_bookings_date_status ON bookings(booking_date, status);
CREATE INDEX idx_bookings_user_date ON bookings(user_id, booking_date, status);

-- ============================================
-- Leaves table (informational — active batch employees declare leave)
-- ============================================
CREATE TABLE IF NOT EXISTS leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  leave_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_leave (user_id, leave_date)
);

CREATE INDEX idx_leaves_date ON leaves(leave_date);

-- ============================================
-- Seed: 50 Physical Seats (S-01 to S-50)
-- ============================================
INSERT INTO seats (seat_number) VALUES
('S-01'),('S-02'),('S-03'),('S-04'),('S-05'),('S-06'),('S-07'),('S-08'),('S-09'),('S-10'),
('S-11'),('S-12'),('S-13'),('S-14'),('S-15'),('S-16'),('S-17'),('S-18'),('S-19'),('S-20'),
('S-21'),('S-22'),('S-23'),('S-24'),('S-25'),('S-26'),('S-27'),('S-28'),('S-29'),('S-30'),
('S-31'),('S-32'),('S-33'),('S-34'),('S-35'),('S-36'),('S-37'),('S-38'),('S-39'),('S-40'),
('S-41'),('S-42'),('S-43'),('S-44'),('S-45'),('S-46'),('S-47'),('S-48'),('S-49'),('S-50');

-- ============================================
-- Seed: Admin user (password: admin123)
-- bcrypt hash for "admin123" with 10 rounds
-- ============================================
INSERT INTO users (name, email, password, batch, role) VALUES
('Admin', 'admin@company.com', '$2b$10$PNnLKBSviZQRzlVFTrpXr.vK8u4FvpJI/fyXqZTFNipmPX.2WZQja', 0, 'admin');

# Seat Booking System — Wissen Technology

A real-time seat booking system built for office space management. Handles 80 employees sharing 50 seats using weekly batch rotation.

## Features

- **Batch Rotation** — Two batches of 40 rotate weekly. Each batch gets priority access to 40 regular seats on their assigned week.
- **Floater Seats** — 10 seats (S-41 to S-50) are open to everyone. Released seats also become temporary floaters.
- **Real-time Updates** — Server-Sent Events (SSE) push booking/release changes instantly to all connected users.
- **Admin Panel** — Manage employees, view bookings, monitor leaves and seat availability.
- **Weekend Blocking** — Bookings only allowed Monday through Friday.

## Tech Stack

- **Backend** — Node.js, Express
- **Database** — MySQL
- **Frontend** — Vanilla HTML/CSS/JS (SPA)
- **Auth** — bcrypt, express-session with MySQL session store
- **Real-time** — Server-Sent Events

## Project Structure

```
├── app.js                   # Express app setup & middleware
├── server.js                # Entry point
├── schema.sql               # DB schema & seed data
├── config/
│   └── db.js                # MySQL connection pool
├── controllers/
│   ├── apiController.js     # SPA JSON API endpoints
│   ├── adminController.js   # Admin panel logic
│   ├── authController.js    # Auth (legacy EJS)
│   ├── bookingController.js # Booking (legacy EJS)
│   └── ...
├── models/                  # DB queries
├── middleware/               # Auth & admin middleware
├── routes/                  # Express route definitions
├── public/                  # SPA frontend
│   ├── index.html
│   ├── css/
│   └── js/
├── views/                   # EJS templates (admin panel)
└── utils/
    └── weekHelper.js        # Batch rotation logic
```

## Setup

### Prerequisites

- Node.js (v16+)
- MySQL (v8+)

### Steps

1. Clone the repo
   ```bash
   git clone https://github.com/mayank2295/Seat-Booking-System-wissen-technology-.git
   cd Seat-Booking-System-wissen-technology-
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create MySQL database — run `schema.sql` in your MySQL client
   ```bash
   mysql -u root -p < schema.sql
   ```

4. Create `.env` file in the root
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=seat_booking
   DB_PORT=3306
   SESSION_SECRET=your_secret_key
   TOTAL_SEATS=50
   WEEK_REF_DATE=2026-01-05
   PORT=3000
   ```

5. Start the server
   ```bash
   npm start
   ```

6. Open `http://localhost:3000` in your browser

### Default Admin Login

- **Email:** admin@company.com
- **Password:** admin123

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | User login |
| POST | `/api/logout` | Destroy session |
| GET | `/api/seats?date=YYYY-MM-DD` | Get all seats for a date |
| POST | `/api/book` | Book a seat |
| POST | `/api/release` | Release a booked seat |
| GET | `/api/my-bookings?employeeId=X` | User's booking history |
| GET | `/api/activity?limit=N` | Recent activity log |
| GET | `/api/schedule?date=YYYY-MM-DD` | Batch schedule info |
| GET | `/api/time` | Server time |
| GET | `/api/stream` | SSE real-time stream |

## How Batch Rotation Works

- 80 employees split into Batch 1 and Batch 2
- Each week, one batch gets priority on 40 regular seats (S-01 to S-40)
- The other batch can only book floater seats (S-41 to S-50) or seats released by the priority batch
- Floater booking opens after 3 PM the day before
- Rotation flips every week based on a reference date

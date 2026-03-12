# Spark Backend

FastAPI backend for the Student Performance Analysis system.

## Features

- Student Information Management
- Attendance Tracking (Auto-sync from KLNCE Portal)
- Mark Management (CIT & University Results)
- Role-Based Authentication (Admin, Staff, Student)
- PostgreSQL Database Integration

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure Environment Variables:
   Create a `.env` file with:
   ```env
   DATABASE_URL=your_postgresql_url
   SECRET_KEY=your_secret_key
   ```

4. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```

## Deployment

This project is configured for deployment on Vercel using `vercel.json`.

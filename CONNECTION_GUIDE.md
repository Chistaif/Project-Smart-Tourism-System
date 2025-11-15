# How to Connect React Frontend with Flask Backend

This guide explains how the React frontend connects to the Python Flask backend.

## Architecture Overview

- **Backend**: Flask API running on `http://localhost:5000`
- **Frontend**: React app running on `http://localhost:3000`
- **Connection**: HTTP REST API with JSON responses

## Setup Steps

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs `flask-cors` which enables cross-origin requests from React.

### 2. Install React Dependencies

```bash
cd UI
npm install
```

### 3. Start Flask Backend

```bash
python app.py
```

The Flask server will run on `http://localhost:5000`

### 4. Start React Frontend

```bash
cd UI
npm start
```

The React app will run on `http://localhost:3000`

## How It Works

### Backend (Flask)

1. **CORS Configuration** (`app.py`):
   - Enables cross-origin requests from React
   - Allows requests from `http://localhost:3000`

2. **API Endpoints** (`blueprints/api.py`):
   - `/api/destinations` - Get all destinations
   - `/api/destinations/<id>` - Get single destination
   - `/api/attractions` - Get all attractions
   - `/api/attractions/search?location=<location>` - Search attractions
   - `/api/health` - Health check

All endpoints return JSON:
```json
{
  "success": true,
  "data": [...]
}
```

### Frontend (React)

1. **API Utility** (`UI/src/utils/api.js`):
   - Centralized API functions
   - Handles fetch requests and error handling
   - Base URL: `http://localhost:5000/api`

2. **Proxy Configuration** (`UI/package.json`):
   - Added `"proxy": "http://localhost:5000"`
   - Allows using relative URLs in development

3. **Component Usage**:
   ```javascript
   import { destinationsAPI } from '../utils/api';
   
   useEffect(() => {
     const fetchData = async () => {
       const response = await destinationsAPI.getAll();
       if (response.success) {
         setDestinations(response.data);
       }
     };
     fetchData();
   }, []);
   ```

## Example API Calls

### From React Component:

```javascript
import { destinationsAPI, attractionsAPI } from '../utils/api';

// Get all destinations
const response = await destinationsAPI.getAll();

// Get single destination
const dest = await destinationsAPI.getById(1);

// Get all attractions
const attrs = await attractionsAPI.getAll();

// Search attractions
const results = await attractionsAPI.search('Ho Chi Minh');
```

### Direct HTTP Requests:

```javascript
// Using fetch directly
fetch('http://localhost:5000/api/destinations')
  .then(res => res.json())
  .then(data => console.log(data));
```

## Testing the Connection

1. Start Flask: `python app.py`
2. Start React: `cd UI && npm start`
3. Open browser: `http://localhost:3000`
4. Check browser console for API responses
5. Test API directly: `http://localhost:5000/api/health`

## Troubleshooting

- **CORS errors**: Make sure Flask-CORS is installed and configured
- **Connection refused**: Ensure Flask is running on port 5000
- **404 errors**: Check that API routes are registered in `blueprints/__init__.py`
- **Proxy issues**: Restart React dev server after adding proxy config

## Production Deployment

For production, you'll need to:
1. Set `REACT_APP_API_URL` environment variable
2. Configure CORS to allow your production domain
3. Use absolute URLs instead of proxy


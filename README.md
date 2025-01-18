# poweredge-fan-conrol
A FastAPI and React-based web interface for dynamically controlling and monitoring server fan speeds and temperatures. Designed for Dell PowerEdge homelab servers, this application uses IPMI commands to provide real-time insights and allow user-defined fan curves or manual fan speed adjustments.

# Fan Control WebUI for Dell PowerEdge Servers

A web interface to monitor and control server fan speeds, designed specifically for homelab enthusiasts running Dell PowerEdge servers. This project utilizes **FastAPI** for the backend and **React** for the frontend to provide a modern, user-friendly solution for server management.

## Features
- **Dashboard**: Real-time temperature and fan speed monitoring.
- **Manual Fan Control**: Set fan speeds directly via sliders or input fields.
- **Custom Fan Curves**: Define temperature-to-fan-speed mappings for dynamic cooling.
- **IPMI Integration**: Leverages IPMI commands for communication with the server.
- **Authentication**: Basic authentication for secure access (optional).
- **Simple Deployment**: Easily run using Docker or standalone services.

## Tech Stack
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/)
- **Frontend**: [React](https://reactjs.org/)
- **Communication**: IPMI tools (`ipmitool`)

## Installation

### Prerequisites
- A Dell PowerEdge server with IPMI access enabled (e.g., iDRAC).
- Python 3.8+ installed.
- Node.js (for running the React app).
- `ipmitool` installed on the server where the backend will run.

### Backend Setup

1.  Clone the repository:
    `git clone https://github.com/your-username/fan-control-webui.git
    cd fan-control-webui/backend` 
    
2.  Install dependencies:
    
    `pip install -r requirements.txt` 
    
3.  Start the FastAPI server: 
    `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
### Frontend Setup

1.  Navigate to the `frontend` folder:
    `cd ../frontend` 
    
2.  Install dependencies:
    `npm install` 
    
3.  Start the development server:
    `npm start` 
    
    The app will be available at `http://localhost:3000`.

### Deployment

-   Use Docker to containerize the app or serve the React frontend statically using FastAPI's `StaticFiles`.
-   For production, bundle the React app (`npm run build`) and serve it alongside the FastAPI backend.

## API Endpoints

### `/status`

-   **GET**: Fetch real-time temperature and fan speed data.

### `/fan/speed`

-   **POST**: Set manual fan speed.
    
    #### Request Body Example:
    ```{
      "speed": 50,
      "fan_id": 0
    }```

### `/fan/curve`

-   **POST**: Update the fan curve for dynamic control.
    
    #### Request Body Example:
    ```[
  { "temperature": 30, "speed": 10 },
  { "temperature": 40, "speed": 20 }
]```

## Security

-   **Credentials**: Avoid storing plain-text credentials in the script. Use environment variables or a secrets manager.
-   **Authentication**: Add token-based authentication or API keys for secure access.

## Contribution

Contributions, bug reports, and feature requests are welcome!  
Feel free to open an issue or submit a pull request.

----------

## License

This project is licensed under the MIT License.  
See the LICENSE file for details.

Let me know if you'd like to make any changes to this!

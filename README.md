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
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/fan-control-webui.git
   cd fan-control-webui/backend

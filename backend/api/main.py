from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import subprocess
from models import FanSpeedRequest, FanCurveRequest, AutoFanSpeedRequest
import config

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)


idrac_address = config.idrac_address
idrac_user = config.idrac_user
idrac_password = config.idrac_password


def run_command(command: str) -> str:
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(result.stderr.strip())
        return result.stdout.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Command failed: {str(e)}")


def parse_auto_fan_speed_output(output: str):
    if "00" in output:
        return True
    else:
        return False


def determine_if_fan_speed_auto() -> bool:
    command = f"ipmitool -I lanplus -H {idrac_address} -U {idrac_user} -P {idrac_password} raw 0x30 0x30 0x01 0x00"
    output = run_command(command)
    print(f"Auto fan output: {output}")
    if "00" in output:
        return True
    else:
        return False


def parse_ipmi_output(output: str) -> dict:
    """
    Parse the ipmitool output into a structured JSON format.
    """
    sensors = []
    for line in output.splitlines():
        parts = line.split("|")
        if len(parts) < 5:
            continue  # Skip invalid lines
        sensor_name = parts[0].strip()
        sensor_value = parts[4].strip()

        # Extract the numeric value (e.g., "26 degrees C" -> 26)
        if "degrees C" in sensor_value:
            value = int(sensor_value.split()[0])
            sensors.append({"name": sensor_name, "value": value, "unit": "C"})

    return {"sensors": sensors}


def parse_fan_speed_output(output: str):
    """
    Parse the ipmitool output for fan speeds into a structured JSON format.
    """
    fan_speeds = []
    for line in output.splitlines():
        parts = line.split("|")
        if len(parts) < 5:
            continue  # Skip invalid lines
        fan_name = parts[0].strip()
        fan_value = parts[4].strip()

        # Extract the numeric RPM value (e.g., "4680 RPM" -> 4680)
        if "RPM" in fan_value:
            rpm_value = int(fan_value.split()[0])
            percentage = int(
                (rpm_value / config.MAX_FAN_RPM) * 100
            )  # Scale to percentage
            fan_speeds.append(
                {"name": fan_name, "rpm": rpm_value, "percentage": percentage}
            )

    return {"fans": fan_speeds}


# Routes
@app.get("/")
def read_root():
    return {"message": "Welcome to the Fan Control API"}


def get_fan_speed():
    """
    Get the current fan speeds from the system.
    """
    command = f"ipmitool -I lanplus -H {idrac_address} -U {idrac_user} -P {idrac_password} sdr type fan"
    output = run_command(command)
    return parse_fan_speed_output(output)


def convert_celsius_to_fahrenheit(celsius: int) -> int:
    return int((celsius * 9 / 5) + 32)


def convert_sensors_to_farhenheit(sensors: list) -> list:
    for sensor in sensors:
        if sensor["unit"] == "C":
            sensor["value"] = convert_celsius_to_fahrenheit(sensor["value"])
            sensor["unit"] = "F"
    return sensors


@app.get("/status")
def get_status():
    """
    Get the current system status, including CPU temperature, ambient temperature, and fan speed.
    """

    command = f"ipmitool -I lanplus -H {idrac_address} -U {idrac_user} -P {idrac_password} sdr type temperature"
    print(command)
    # command = f"ipmitool -I lan -H {idrac_address} -U {idrac_user} -P {idrac_password} sdr type temperature"

    output = run_command(command)
    parsed_data = parse_ipmi_output(output)

    sensors = parsed_data["sensors"]
    fan_speeds = get_fan_speed()["fans"]
    return {
        "sensors": convert_sensors_to_farhenheit(sensors),
        "fans": fan_speeds,
        "autoFanSpeedEnabled": determine_if_fan_speed_auto(),
    }


@app.post("/fan/speed")
def update_fan_speeds(request: FanSpeedRequest):
    """
    Update all fan speeds to the same percentage.
    """
    if request.percentage < 0 or request.percentage > 100:
        raise HTTPException(
            status_code=400, detail="Percentage must be between 0 and 100."
        )

    try:
        # Ensure the percentage is within bounds and map to 0x00–0x64
        hex_speed = format((request.percentage), "02x")  # Convert directly to 0x00–0x64

        # Construct the IPMI command to set all fans
        command = (
            f"ipmitool -I lanplus -H {idrac_address} -U {idrac_user} -P {idrac_password} "
            f"raw 0x30 0x30 0x02 0xff 0x{hex_speed}"
        )

        print(f"Setting all fans to {request.percentage}%\nCommand: {command}")

        # Execute the command
        run_command(command)

        # Optionally fetch updated fan speeds for confirmation
        fan_speeds = get_fan_speed()["fans"]

        return {
            "message": "Fan speeds updated successfully",
            "fans": fan_speeds,
            "autoFanSpeedEnabled": determine_if_fan_speed_auto(),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update fan speeds: {str(e)}"
        )


# Enable/Disable auto fan speed
@app.post("/fan/auto")
def auto_fan_speed(request: AutoFanSpeedRequest):

    enabled = request.enabled

    try:
        if enabled:
            command = (
                f"ipmitool -I lanplus -H {idrac_address} -U {idrac_user} -P {idrac_password} "
                f"raw 0x30 0x30 0x01 0x01"
            )
        else:
            command = (
                f"ipmitool -I lanplus -H {idrac_address} -U {idrac_user} -P {idrac_password} "
                f"raw 0x30 0x30 0x01 0x00"
            )
        run_command(command)
        return {
            "message": f"Fan speed auto mode {'enabled' if enabled else 'disabled'}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to set fan speed to auto: {str(e)}"
        )


@app.post("/fan/curve")
def update_fan_curve(request: FanCurveRequest):
    """
    Update the fan speed curve.
    """
    if len(request.curve) != 5:
        raise HTTPException(
            status_code=400, detail="Fan curve must contain exactly 5 values."
        )
    if any(speed < 0 or speed > 100 for speed in request.curve):
        raise HTTPException(
            status_code=400, detail="All fan curve values must be between 0 and 100."
        )
    system_state = {"fan_curve": request.curve}

    return {
        "message": "Fan curve updated successfully",
        "curve": system_state["fan_curve"],
    }

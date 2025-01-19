from pydantic import BaseModel
from typing import List


# Models
class FanSpeedRequest(BaseModel):
    percentage: int  # Single percentage for all fans


class FanCurveRequest(BaseModel):
    curve: List[int]  # List of fan speed values in %


class AutoFanSpeedRequest(BaseModel):
    enabled: bool  # Enable or disable auto fan speed

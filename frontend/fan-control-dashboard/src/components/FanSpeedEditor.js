import React, { useState, useEffect } from "react";
import { fetcher } from "../api";
import { Switch } from "@mui/material";
const FanSpeedEditor = ({
  fanSpeeds,
  setFanSpeeds,
  isLoadingSpeeds,
  setIsLoadingSpeeds,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [globalPercentage, setGlobalPercentage] = useState(0); // Input for all fans

  const handleFanSpeedUpdate = async () => {
    setIsUpdating(true);

    try {
      const response = await handleUpdateAutoFanSpeed("disable");
      console.log(response);
    } catch (error) {
      console.error("Error toggling auto fan speed:", error);
      alert("Failed to toggle auto fan speed.");
    } finally {
      setIsUpdating(false);
    }

    try {
      //   const updatedSpeeds = fanSpeeds.map((fan) => ({
      //     ...fan,
      //     percentage: globalPercentage,
      //   }));

      // Send updated speeds to the backend
      const response = await fetcher("/fan/speed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          percentage: globalPercentage,
        }),
      });
      console.log(response);
      // Update frontend state

      alert("Fan speeds updated successfully!");

      setFanSpeeds(response?.fans || []);
      //   setGlobalPercentage(response?.fans[0]?.percentage || 0);
    } catch (error) {
      console.error("Error updating fan speeds:", error);
      alert("Failed to update fan speeds.");
    } finally {
      setIsUpdating(false);
    }
  };
  const handleUpdateAutoFanSpeed = async (action) => {
    let enabled = false;
    if (action === "enable") {
      enabled = true;
    } else {
      enabled = false;
    }

    setIsLoadingSpeeds(true);
    try {
      const response = await fetcher("/fan/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: enabled,
        }),
      });
    } catch (error) {
      console.error("Error toggling auto fan speed:", error);
      alert("Failed to toggle auto fan speed.");
    } finally {
      setIsLoadingSpeeds(false);
    }
  };
  useEffect(() => {
    setGlobalPercentage(fanSpeeds[0]?.percentage || 0);
  }, [fanSpeeds]);

  if (isLoadingSpeeds) {
    return <p>Loading fan speeds...</p>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-lg font-bold text-dark mb-4">Fan Speed Editor</h2>
      <p className="text-sm text-gray-600 mb-4">
        Adjust the fan speeds for your server manually. All fans will be set to
        the same percentage.
      </p>
      <div className="mb-6">
        <p className="text-sm text-gray-600">Set Fan Speed (%)</p>
        <input
          type="number"
          value={globalPercentage}
          onChange={(e) => {
            setGlobalPercentage(
              Math.min(Math.max(Number(e.target.value), 0), 100)
            );
          }}
          min="0"
          max="100"
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {fanSpeeds.map((fan, index) => (
          <div key={index} className="mb-4">
            <p className="text-sm text-gray-600">
              {fan.name} (RPM: {fan.rpm}) - {fan.percentage}%
            </p>
          </div>
        ))}
      </div>
      <button
        onClick={handleFanSpeedUpdate}
        disabled={isUpdating}
        className={`bg-primary text-white px-4 py-2 rounded shadow hover:bg-primary-dark mt-4 ${
          isUpdating ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {isUpdating ? "Updating..." : "Update Fan Speeds"}
      </button>

      <button
        onClick={() => handleUpdateAutoFanSpeed("enable")}
        disabled={isUpdating}
        className={`bg-primary text-white px-4 py-2 rounded shadow hover:bg-primary-dark mt-4 ${
          isUpdating ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        Enable Auto Fan Speed
      </button>
    </div>
  );
};

export default FanSpeedEditor;

import React, { useState } from "react";
import { Slider } from "@mui/material";
import { fetcher } from "../api";

const FanCurveEditor = () => {
  const [fanCurve, setFanCurve] = useState([10, 20, 30, 40, 50]); // Initial fan curve values
  const [isLoading, setIsLoading] = useState(false); // Loading state for API requests

  const handleFanCurveUpdate = async () => {
    setIsLoading(true); // Show loading indicator
    try {
      // Send updated fan curve to the backend
      await fetcher("/fan/curve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curve: fanCurve }),
      });
      alert("Fan curve updated successfully!");
    } catch (error) {
      console.error("Error updating fan curve:", error);
      alert("Failed to update fan curve.");
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-dark mb-6">Fan Curve Editor</h2>
      <p className="text-sm text-gray-600 mb-4">
        Adjust the fan curve steps to control fan speed at different temperature
        levels.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fanCurve.map((value, index) => (
          <div key={index} className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Step {index + 1}</p>
            <Slider
              value={value}
              onChange={(e, val) => {
                const updatedCurve = [...fanCurve];
                updatedCurve[index] = val;
                setFanCurve(updatedCurve);
              }}
              min={0}
              max={100}
              valueLabelDisplay="auto"
              className="text-primary"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleFanCurveUpdate}
        disabled={isLoading} // Disable button while updating
        className={`bg-primary text-white px-4 py-2 rounded shadow hover:bg-primary-dark mt-6 ${
          isLoading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {isLoading ? "Updating..." : "Update Fan Curve"}
      </button>
    </div>
  );
};

export default FanCurveEditor;

import React, { useEffect, useState } from "react";
import { fetcher } from "../api";
import { motion } from "framer-motion";

import { Typography } from "@mui/material";

const StatCard = ({ title, value, unit }) => {
  return (
    <motion.div
      className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition"
      whileHover={{ scale: 1.05 }}
    >
      <h2 className="text-lg font-semibold text-dark">{title}</h2>
      <p className="text-3xl font-bold text-primary">
        {value}
        <span className="text-xl text-gray-600"> {unit}</span>
      </p>
    </motion.div>
  );
};

const FanSpeedCard = ({ name, value, unit }) => {
  return (
    <motion.div
      className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition"
      whileHover={{ scale: 1.05 }}
    >
      <h2 className="text-lg font-semibold text-dark">{name}</h2>
      <p className="text-3xl font-bold text-primary">
        {value}
        <span className="text-xl text-gray-600"> {unit}</span>
      </p>
    </motion.div>
  );
};

const Stats = ({ fanSpeeds, setFanSpeeds, loading, setLoading }) => {
  const [stats, setStats] = useState(null);
  const [sensors, setSensors] = useState([]);

  //   const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await fetcher("/status");
        setStats(data);
        setSensors(data["sensors"]);
        setFanSpeeds(data["fans"]);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!stats) {
    return <p>Failed to load stats.</p>;
  }

  return (
    <>
      {/* Section: Temperature Sensors */}
      <div className="mb-8">
        <Typography
          variant="h5"
          className="text-primary font-bold border-b border-gray-300 pb-2 mb-4"
        >
          Temperature Sensors
        </Typography>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sensors.map((sensor, index) => (
            <div
              key={index}
              className="bg-white shadow-lg rounded-lg p-6 border-t-4 border-primary hover:shadow-xl transition"
            >
              <Typography
                variant="subtitle1"
                className="font-semibold text-gray-600"
              >
                {sensor.name}
              </Typography>
              <Typography variant="h4" className="text-dark font-bold mt-2">
                {sensor.value}{" "}
                <span className="text-gray-500 text-lg">{sensor.unit}</span>
              </Typography>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Fan Speeds */}
      <div>
        <Typography
          variant="h5"
          className="text-primary font-bold border-b border-gray-300 pb-2 mb-4"
        >
          Fan Speeds
        </Typography>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {fanSpeeds.map((fan, index) => (
            <div
              key={index}
              className="bg-white shadow-lg rounded-lg p-6 border-t-4 border-accent hover:shadow-xl transition"
            >
              <Typography
                variant="subtitle1"
                className="font-semibold text-gray-600"
              >
                {fan.name}
              </Typography>
              <Typography variant="h4" className="text-dark font-bold mt-2">
                {fan.rpm}{" "}
                <span className="text-gray-500 text-lg">{fan.percentage}%</span>
                {/* display Percentage */}
              </Typography>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Stats;

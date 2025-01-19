import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register the required components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const FanSpeedGraph = () => {
  const data = {
    labels: ["10:00", "10:05", "10:10", "10:15"],
    datasets: [
      {
        label: "Fan Speed (%)",
        data: [20, 40, 35, 50],
        borderColor: "#4F46E5",
        backgroundColor: "rgba(79, 70, 229, 0.2)",
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
      title: {
        display: true,
        text: "Fan Speed Trends",
      },
    },
    scales: {
      x: {
        type: "category",
      },
      y: {
        type: "linear",
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-lg font-bold text-dark mb-4">Fan Speed Trends</h2>
      <Line data={data} options={options} />
    </div>
  );
};

export default FanSpeedGraph;

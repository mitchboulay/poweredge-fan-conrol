import React, { useState } from "react";
import DashboardLayout from "./components/DashboardLayout";
// import Stats from "./components/Stats";
import Stats from "./components/Stats";
import FanSpeedEditor from "./components/FanSpeedEditor";
import FanCurveEditor from "./components/FanCurveEditor";
import FanSpeedGraph from "./components/FanSpeedGraph";

const App = () => {
  const [fanSpeeds, setFanSpeeds] = useState([]);

  const [loading, setLoading] = useState(true);
  return (
    <DashboardLayout>
      <Stats
        fanSpeeds={fanSpeeds}
        setFanSpeeds={setFanSpeeds}
        loading={loading}
        setLoading={setLoading}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <FanSpeedEditor
          fanSpeeds={fanSpeeds}
          setFanSpeeds={setFanSpeeds}
          isLoadingSpeeds={loading}
          setIsLoadingSpeeds={setLoading}
        />
        {/* <FanCurveEditor />
        <FanSpeedGraph /> */}
      </div>
    </DashboardLayout>
  );
};

export default App;

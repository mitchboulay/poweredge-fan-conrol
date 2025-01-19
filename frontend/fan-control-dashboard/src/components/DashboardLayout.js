import React from "react";

const DashboardLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-dark text-white p-4">
        <h1 className="text-2xl font-bold mb-6">Fan Control</h1>
        <nav>
          <ul>
            <li className="mb-4">
              <a href="/" className="text-lg hover:text-primary">
                Dashboard
              </a>
            </li>
            <li>
              <a href="/settings" className="text-lg hover:text-primary">
                Settings
              </a>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
};

export default DashboardLayout;

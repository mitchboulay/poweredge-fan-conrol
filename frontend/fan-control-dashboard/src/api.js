const API_BASE_URL = "http://localhost:8081";

export const fetcher = async (url, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${url}`, options);
  if (!response.ok) {
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  }
  return response.json();
};

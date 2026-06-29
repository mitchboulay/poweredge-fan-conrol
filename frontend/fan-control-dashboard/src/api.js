const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? "";

export const fetcher = async (url, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${url}`, options);
  if (!response.ok) {
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  }
  return response.json();
};

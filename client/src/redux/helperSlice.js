import { createSlice } from "@reduxjs/toolkit";

// Safely parse the user from localStorage
let parsedUser = null;
try {
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    parsedUser = JSON.parse(storedUser);
  }
} catch (error) {
  console.warn("Invalid JSON in localStorage for 'user':", error);
  localStorage.removeItem("user"); // Remove corrupted entry to avoid future errors
}

const initialState = {
  user: parsedUser,
};

const helperSlice = createSlice({
  name: "helper",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload;
      try {
        localStorage.setItem("user", JSON.stringify(action.payload));
      } catch (error) {
        console.error("Failed to store user in localStorage:", error);
      }
    },
    removeCredentials: (state) => {
      state.user = null;
      localStorage.removeItem("user");
    },
  },
});

export const { setCredentials, removeCredentials } = helperSlice.actions;

export default helperSlice.reducer;

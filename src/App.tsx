import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useState, useEffect, createContext, useContext } from "react";
import { BookingPage } from "./features/booking/pages/BookingPage";
import { ConfirmationPage } from "./features/booking/pages/ConfirmationPage";

export const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

function Root() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  const router = createBrowserRouter([
    { path: "/", element: <BookingPage /> },
    { path: "/confirmed", element: <ConfirmationPage /> },
    { path: "*", element: <BookingPage /> },
  ]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <RouterProvider router={router} />
    </ThemeContext.Provider>
  );
}

export default Root;

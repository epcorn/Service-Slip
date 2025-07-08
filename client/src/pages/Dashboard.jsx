import React, { useState, useMemo } from "react";
import { Chart as ChartJS, Title, defaults } from "chart.js/auto";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { useChartDataQuery } from "../redux/challanSlice";
import { AlertMessage, Loading } from "../components";

defaults.responsive = true;

// ✨ Configure datalabels plugin with rounding and Indian number formatting
ChartJS.register(Title, ChartDataLabels);
ChartJS.defaults.set("plugins.datalabels", {
  color: "black",
  anchor: "end",
  align: "top",
  formatter: (value) =>
    value > 0 ? Math.round(value).toLocaleString("en-IN") : "",
  font: { size: 14 },
});

const generateYearOptions = (numYears = 5) => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i < numYears; i++) {
    years.push(currentYear - i);
  }
  return years;
};

const Dashboard = () => {
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const yearOptions = useMemo(() => generateYearOptions(5), []);
  const monthOptions = useMemo(
    () => [
      { value: "1", label: "Jan" },
      { value: "2", label: "Feb" },
      { value: "3", label: "Mar" },
      { value: "4", label: "Apr" },
      { value: "5", label: "May" },
      { value: "6", label: "Jun" },
      { value: "7", label: "Jul" },
      { value: "8", label: "Aug" },
      { value: "9", label: "Sep" },
      { value: "10", label: "Oct" },
      { value: "11", label: "Nov" },
      { value: "12", label: "Dec" },
    ],
    []
  );

  const filters = useMemo(() => {
    if (startDate && endDate) {
      return { startDate, endDate };
    }
    return {
      year: selectedYear || undefined,
      month: selectedMonth || undefined,
    };
  }, [selectedYear, selectedMonth, startDate, endDate]);

  const cleanFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v != null && v !== "")
      ),
    [filters]
  );

  const {
    data,
    isLoading: chartLoading,
    error,
  } = useChartDataQuery(cleanFilters);

  const handleYearChange = (e) => {
    setSelectedYear(e.target.value);
    setStartDate("");
    setEndDate("");
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
    setStartDate("");
    setEndDate("");
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    setSelectedYear("");
    setSelectedMonth("");
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    setSelectedYear("");
    setSelectedMonth("");
  };

  const clearFilters = () => {
    setSelectedYear("");
    setSelectedMonth("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="bg-slate-100 min-h-screen pb-10">
      <h1 className="text-center text-lime-500 text-4xl font-semibold pt-16 pb-5 lg:pt-6 lg:pb-3">
        Dashboard
      </h1>

      <div className="bg-gray-100 p-4 mb-6 mx-2 md:mx-10 rounded border border-gray-300 shadow-sm flex flex-wrap gap-4 items-center justify-center">
        <div className="flex items-center">
          <label
            htmlFor="yearFilter"
            className="mr-2 font-medium text-gray-700"
          >
            Year:
          </label>
          <select
            id="yearFilter"
            value={selectedYear}
            onChange={handleYearChange}
            className="p-2 border rounded border-gray-300 focus:border-lime-500 focus:ring focus:ring-lime-200 focus:ring-opacity-50"
          >
            <option value="">All Years</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
          <label
            htmlFor="monthFilter"
            className="mr-2 font-medium text-gray-700"
          >
            Month:
          </label>
          <select
            id="monthFilter"
            value={selectedMonth}
            onChange={handleMonthChange}
            className="p-2 border rounded border-gray-300 focus:border-lime-500 focus:ring focus:ring-lime-200 focus:ring-opacity-50 disabled:opacity-50"
          >
            <option value="">All Months</option>
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="startDate" className="font-medium text-gray-700">
            Date Range:
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={handleStartDateChange}
            className="p-2 border rounded border-gray-300 focus:border-lime-500 focus:ring focus:ring-lime-200 focus:ring-opacity-50"
          />
          <span className="mx-1 text-gray-600">to</span>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={handleEndDateChange}
            min={startDate || undefined}
            disabled={!startDate}
            className="p-2 border rounded border-gray-300 focus:border-lime-500 focus:ring focus:ring-lime-200 focus:ring-opacity-50 disabled:opacity-50"
          />
        </div>

        <button
          onClick={clearFilters}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out shadow"
        >
          Clear Filters
        </button>
      </div>

      {chartLoading && <Loading />}
      {error && !chartLoading && (
        <div className="mx-2 md:mx-10">
          <AlertMessage>
            {error?.data?.msg || error.error || "Failed to load chart data"}
          </AlertMessage>
        </div>
      )}

      {data && !chartLoading && (
        <div className="mx-2 md:mx-10 mb-2 lg:py-2 grid lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-300 rounded shadow-md p-2">
            <h2 className="text-center text-xl font-semibold text-gray-700 mb-2">
              Cash Collection
            </h2>
            {data.cashData && data.cashData.length > 1 ? (
              <div style={{ height: "250px" }}>
                <Bar
                  data={{
                    labels: data.cashData.map((item) => item.label),
                    datasets: [
                      {
                        label: "Amount",
                        data: data.cashData.map((item) => item.value),
                        backgroundColor: [
                          "#808080",
                          "#22c55e",
                          "#ef4444",
                          "#f97316",
                          "#3b82f6",
                          "#ec4899",
                        ],
                        borderRadius: 5,
                      },
                    ],
                  }}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { title: { display: false } },
                  }}
                />
              </div>
            ) : (
              <p className="text-center p-10 text-gray-500">
                No cash data for selected period.
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-300 rounded shadow-md p-2">
            <h2 className="text-center text-xl font-semibold text-gray-700 mb-2">
              Bill Collection
            </h2>
            {data.billData && data.billData.length > 1 ? (
              <div style={{ height: "250px" }}>
                <Bar
                  data={{
                    labels: data.billData.map((item) => item.label),
                    datasets: [
                      {
                        label: "Amount",
                        data: data.billData.map((item) => item.value),
                        backgroundColor: [
                          "#808080",
                          "#22c55e",
                          "#ef4444",
                          "#f97316",
                          "#3b82f6",
                          "#ec4899",
                        ],
                        borderRadius: 5,
                      },
                    ],
                  }}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { title: { display: false } },
                  }}
                />
              </div>
            ) : (
              <p className="text-center p-10 text-gray-500">
                No bill data for selected period.
              </p>
            )}
          </div>

          <div className="lg:col-span-2 bg-white border border-gray-300 rounded shadow-md p-2">
            <h2 className="text-center text-xl font-semibold text-gray-700 mb-2">
              Service Slips Status
            </h2>
            {data.slipData && data.slipData.length > 1 ? (
              <div style={{ height: "200px" }}>
                <Bar
                  data={{
                    labels: data.slipData.map((item) => item.label),
                    datasets: [
                      {
                        label: "Slips",
                        data: data.slipData.map((item) => item.value),
                        backgroundColor: [
                          "#4b5563",
                          "#10b981",
                          "#6366f1",
                          "#f59e0b",
                          "#ef4444",
                          "#ec4899",
                          "#d946ef",
                        ],
                        borderRadius: 5,
                      },
                    ],
                  }}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { title: { display: false } },
                  }}
                />
              </div>
            ) : (
              <p className="text-center p-10 text-gray-500">
                No slip data for selected period.
              </p>
            )}
          </div>
        </div>
      )}

      {!chartLoading &&
        data &&
        !(
          data.cashData?.length > 1 ||
          data.billData?.length > 1 ||
          data.slipData?.length > 1
        ) &&
        !error && (
          <p className="text-center p-5 text-gray-600 mx-2 md:mx-10">
            No specific chart data available for the selected filters.
          </p>
        )}
    </div>
  );
};

export default Dashboard;

import { useState, useEffect, useRef } from "react";
import { AiOutlineClose, AiOutlineSearch } from "react-icons/ai";
import { Link } from "react-router-dom";
import { AlertMessage, Button, Loading } from "../components";
import { useSelector } from "react-redux";
import { useAllChallanQuery } from "../redux/challanSlice";
import { dateFormat } from "../utils/functionHelper";
import { jobStatus } from "../utils/constData";

const Home = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [tempSearch, setTempSearch] = useState("");
  const [page, setPage] = useState(1);
  // --- ADDED: New state for sorting order ---
  const [sortOrder, setSortOrder] = useState("desc"); // Default to 'desc' (latest first)
  // --- END ADDED ---

  const { user } = useSelector((store) => store.helper);

  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayClass, setOverlayClass] = useState("");
  const loadingStartTime = useRef(0);

  // --- UPDATED: Pass sortOrder to useAllChallanQuery ---
  const { data, isLoading, isFetching, error } = useAllChallanQuery({
    search,
    page,
    status,
    sort: sortOrder, // Pass the new sortOrder state
  });
  // --- END UPDATED ---

  // Effect to manage overlay visibility and animation based on isFetching and minimum display time
  useEffect(() => {
    const MIN_LOAD_TIME = 15; // Changed to 15 milliseconds
    let timer;

    if (isFetching) {
      loadingStartTime.current = Date.now();
      setShowOverlay(true);
      setOverlayClass("fade-in");
    } else {
      const timeElapsed = Date.now() - loadingStartTime.current;
      const timeRemaining = MIN_LOAD_TIME - timeElapsed;

      if (timeRemaining > 0) {
        timer = setTimeout(() => {
          setOverlayClass("fade-out");
          const fadeOutTimer = setTimeout(() => setShowOverlay(false), 300); // Wait for fade-out anim
          return () => clearTimeout(fadeOutTimer);
        }, timeRemaining);
      } else {
        setOverlayClass("fade-out");
        timer = setTimeout(() => setShowOverlay(false), 300); // Wait for fade-out anim
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isFetching]); // No need to add sortOrder here as RTK Query handles refetching automatically when params change

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(tempSearch);
  };

  const clearSearch = () => {
    setTempSearch("");
    setSearch("");
    setStatus("All");
    setPage(1);
    // --- ADDED: Reset sortOrder on clear search ---
    setSortOrder("desc"); // Reset to default sort order
    // --- END ADDED ---
  };

  // --- ADDED: Handler for sort order change ---
  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
    setPage(1); // Reset to page 1 when sort order changes
  };
  // --- END ADDED ---

  const progress = (status) => {
    let text = "text-blue-700 bg-blue-100";
    if (status === "Completed") text = "text-green-700 bg-green-100";
    else if (status === "Partially Completed")
      text = "text-pink-700 bg-pink-100";
    else if (status === "Cancelled" || status === "Not Completed")
      text = "text-red-700 bg-red-100";

    return (
      <p
        className={`inline-flex items-center rounded-md px-2 py-1 font-medium ${text} ring-1 ring-gray-300`}
      >
        {status}
      </p>
    );
  };

  const totalPages = data?.pages || 1;
  const maxPageButtons = 5;

  let startPageInBlock;
  let endPageInBlock;

  const currentBlock = Math.ceil(page / maxPageButtons);

  startPageInBlock = (currentBlock - 1) * maxPageButtons + 1;
  endPageInBlock = Math.min(startPageInBlock + maxPageButtons - 1, totalPages);

  if (page < startPageInBlock || page > endPageInBlock) {
    setPage(Math.max(1, startPageInBlock));
  }

  const pagesToDisplay = Array.from(
    { length: endPageInBlock - startPageInBlock + 1 },
    (_, index) => startPageInBlock + index
  );

  const goToPrevBlock = () => {
    const newPage = Math.max(1, startPageInBlock - maxPageButtons);
    setPage(newPage);
  };

  const goToNextBlock = () => {
    const newPage = Math.min(totalPages, endPageInBlock + 1);
    setPage(newPage);
  };

  return (
    <>
      {isLoading ? (
        <Loading />
      ) : (
        error && <AlertMessage>{error?.data?.msg || error.error}</AlertMessage>
      )}
      <div className="mx-10 my-20 lg:my-5">
        <div className="px-2 mb-5">
          <div className="md:flex items-center justify-between">
            <p className=" text-center lg:text-2xl font-bold leading-normal text-gray-800">
              All Service Slips
            </p>
            <form onSubmit={handleSearch} className="flex items-center">
              <div className="flex items-center px-1 bg-white border md:w-52 lg:w-80 rounded border-gray-300 mr-3">
                <AiOutlineSearch />
                <input
                  type="text"
                  className="py-1 md:py-1.5 pl-1 w-full focus:outline-none text-sm rounded text-gray-600 placeholder-gray-500"
                  placeholder="Search..."
                  value={tempSearch}
                  onChange={(e) => setTempSearch(e.target.value)}
                />
                {tempSearch && (
                  <button type="button" onClick={clearSearch}>
                    <AiOutlineClose color="red" />
                  </button>
                )}
              </div>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="border-2 rounded-md mr-2 py-1 w-44"
              >
                {[
                  "All",
                  "Open",
                  ...jobStatus.map((item) => item.label),
                  "Cancelled",
                ].map((item, index) => (
                  <option key={index} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {/* --- ADDED: Sort Order Dropdown --- */}
              <select
                value={sortOrder}
                onChange={handleSortChange} // Use the new handler
                className="border-2 rounded-md mr-2 py-1 w-44"
              >
                <option value="desc">Latest First</option>
                <option value="asc">Oldest First</option>
              </select>
              {/* --- END ADDED --- */}

              <Button
                type="submit"
                label="Search"
                color="bg-black"
                height="h-8"
              />
            </form>
            <div className="flex items-end justify-around mt-4 md:mt-0 md:ml-3 lg:ml-0">
              {(user.role === "Admin" || user.role === "Sales") && (
                <Link to="/create">
                  <Button
                    label="Create Service Slip"
                    height="h-9"
                    color="bg-green-600"
                  />
                </Link>
              )}
            </div>
          </div>
        </div>
        {data?.challans.length === 0 && !isFetching && (
          <h6 className="text-red-500 text-xl font-semibold text-center mb-2">
            No Service Slip Found
          </h6>
        )}
        <div className="overflow-y-auto my-4 relative">
          {showOverlay && (
            <div
              className={`absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10 ${overlayClass}`}
            >
              <Loading />
            </div>
          )}
          <table className="w-full border whitespace-nowrap border-neutral-500">
            <thead>
              <tr className="h-12 w-full text-md leading-none text-gray-600">
                <th className="font-bold text-left  border-neutral-800 border-2 w-20 px-3">
                  Slip Number
                </th>
                <th className="font-bold text-center  border-neutral-800 border-2 w-28 px-3">
                  Date
                </th>
                <th className="font-bold text-left  border-neutral-800 border-2 px-3">
                  Customer Name
                </th>
                <th className="font-bold text-left  border-neutral-800 border-2 px-3">
                  Sales Representative
                </th>
                <th className="font-bold text-center  border-neutral-800 border-2 w-32 px-3">
                  Service Date
                </th>
                <th className="font-bold max-w-[100px] text-center  border-neutral-800 border-2 w-40 px-3">
                  Progress
                </th>
                {user.role !== "Service Operator" && (
                  <th className="font-bold text-center  border-neutral-800 border-2 w-24 px-2">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="w-full">
              {data?.challans.map((challan) => (
                <tr
                  key={challan._id}
                  className="h-12 text-sm leading-none text-gray-700 border-b border-neutral-500 bg-white hover:bg-gray-100"
                >
                  <td className="px-3 border-r text-center font-normal border-neutral-500">
                    {challan.number}
                  </td>
                  <td className="px-3 border-r font-normal text-center border-neutral-500">
                    {dateFormat(challan.createdAt)}
                  </td>
                  <td className="px-3 border-r font-normal border-neutral-500">
                    {challan.shipToDetails.name}
                  </td>
                  <td className="px-3 border-r font-normal border-neutral-500">
                    {challan.sales.label}
                  </td>
                  <td className="px-3 border-r font-normal text-center border-neutral-500">
                    {dateFormat(challan.serviceDate)}
                  </td>
                  <td className="px-3 border-r font-normal text-center border-neutral-500">
                    {progress(
                      challan.update[challan.update.length - 1]?.status
                    )}
                  </td>
                  {user.role !== "Service Operator" && (
                    <td className="px-3 border-r font-normal text-center border-neutral-500">
                      <Link to={`/challan/${challan._id}`}>
                        <Button label="Details" height="h-7" small />
                      </Link>
                      <a href={challan.file} target="_blank" rel="noreferrer">
                        <Button
                          label="Download"
                          color="bg-emerald-500"
                          height="h-7"
                          small
                        />
                      </a>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <nav className="mb-4">
            <ul className="list-style-none flex justify-center mt-2">
              {/* Previous Block Button */}
              <li className="pr-1">
                <button
                  className={`relative block rounded px-3 py-1.5 text-sm transition-all duration-300 ${
                    startPageInBlock === 1
                      ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                      : "bg-neutral-700 text-white hover:bg-blue-400"
                  }`}
                  onClick={goToPrevBlock}
                  disabled={startPageInBlock === 1}
                >
                  &lt; {/* HTML entity for < */}
                </button>
              </li>

              {/* Page Numbers */}
              {pagesToDisplay.map((item) => (
                <li className="pr-1" key={item}>
                  <button
                    className={`relative block rounded px-3 py-1.5 text-sm transition-all duration-300 ${
                      page === item ? "bg-blue-400" : "bg-neutral-700"
                    } text-white hover:bg-blue-400`}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                </li>
              ))}

              {/* Next Block Button */}
              <li className="pr-1">
                <button
                  className={`relative block rounded px-3 py-1.5 text-sm transition-all duration-300 ${
                    endPageInBlock === totalPages
                      ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                      : "bg-neutral-700 text-white hover:bg-blue-400"
                  }`}
                  onClick={goToNextBlock}
                  disabled={endPageInBlock === totalPages}
                >
                  &gt; {/* HTML entity for > */}
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </>
  );
};
export default Home;

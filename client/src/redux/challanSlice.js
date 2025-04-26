import { apiSlice } from "./apiSlice";

export const challanSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createChallan: builder.mutation({
      query: (data) => ({
        url: "/api/challan",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Challan"],
    }),
    updateChallan: builder.mutation({
      query: ({ id, data }) => ({
        url: `/api/challan/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Challan"],
    }),
    singleChallan: builder.query({
      query: (id) => ({
        url: `/api/challan/${id}`,
      }),
      providesTags: ["Challan"],
      keepUnusedDataFor: 1,
    }),
    allChallan: builder.query({
      query: ({ search, page, status }) => ({
        url: "/api/challan",
        params: { search, page, status },
      }),
      providesTags: ["Challan"],
      keepUnusedDataFor: 1,
    }),
    verifyAmount: builder.mutation({
      query: ({ id, data }) => ({
        url: `/api/challan/verify/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Challan"],
    }),

    // =============================================
    // === UPDATED chartData endpoint definition ===
    // =============================================
    chartData: builder.query({
      // The query function now accepts an argument, typically an object.
      // Let's call it 'filters'. It might be undefined/null if no filters are applied.
      query: (filters) => {
        // Prepare the params object based on the filters received.
        // Use optional chaining filters?.fieldName for safety if 'filters' might be null/undefined.
        const params = {
          year: filters?.year,
          month: filters?.month,
          startDate: filters?.startDate,
          endDate: filters?.endDate,
        };

        // Clean the params object to remove any keys with null, undefined or empty string values.
        // This prevents sending empty query parameters like &year= or &month=
        const cleanParams = Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v != null && v !== "")
        );

        // Return the configuration object for the request.
        // RTK Query will automatically append `cleanParams` as URL query parameters.
        // e.g., /api/challan/chartData?year=2024&month=12
        return {
          url: "/api/challan/chartData",
          params: cleanParams,
        };
      },
      // Keep the existing providesTags - invalidating "Challan" will now refetch chart data
      // respecting the filters currently applied by the component.
      providesTags: ["Challan"],
      // Keep the existing keepUnusedDataFor setting.
      keepUnusedDataFor: 1,
    }),
    // =============================================
    // === END UPDATED chartData definition ===
    // =============================================

    unverifiedChallan: builder.query({
      query: ({ search, status }) => ({
        url: "/api/challan/unverified",
        params: { search, status },
      }),
      providesTags: ["Challan"],
      keepUnusedDataFor: 1,
    }),
    makeInvoice: builder.mutation({
      query: ({ id, data }) => ({
        url: `/api/challan/makeInvoice/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Challan"],
    }),
    operatorComments: builder.query({
      query: () => ({
        url: "/api/challan/operatorComments",
      }),
      providesTags: ["Admin"], // Note: This still provides "Admin" tag
    }),
    cancelChallan: builder.mutation({
      query: ({ id, data }) => ({
        url: `/api/challan/cancel/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Challan"],
    }),
    searchClient: builder.query({
      query: ({ search }) => ({
        url: "/api/challan/clientName",
        params: { search },
      }),
      providesTags: ["Challan"],
      keepUnusedDataFor: 1,
    }),
  }),
});

// Ensure this export includes useChartDataQuery
export const {
  useCreateChallanMutation,
  useUpdateChallanMutation,
  useSingleChallanQuery,
  useAllChallanQuery,
  useVerifyAmountMutation,
  useChartDataQuery, // Make sure this hook is exported
  useUnverifiedChallanQuery,
  useMakeInvoiceMutation,
  useOperatorCommentsQuery,
  useCancelChallanMutation,
  useSearchClientQuery,
} = challanSlice;

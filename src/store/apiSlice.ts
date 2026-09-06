import type { TimetableGenerationResult } from '@/types/graphTypes';
import type { MiniModuleData, ModuleData } from '@/types/plannerTypes';
import type { StudentContext } from '@/types/prerequisiteTypes';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  endpoints: (builder) => ({
    getModuleByCode: builder.query<ModuleData, string>({
      // Keep the full catalogue behind a route handler. Importing the server
      // lookup here would bundle moduleData.json into every planner client.
      query: (code) => `/api/modules/${encodeURIComponent(code.toUpperCase())}`,
      keepUnusedDataFor: Number.MAX_VALUE,
    }),

    getModuleSummaries: builder.query<MiniModuleData[], string[]>({
      query: (codes) => ({
        url: '/api/modules/summaries',
        method: 'POST',
        body: { codes },
      }),
      keepUnusedDataFor: Number.MAX_VALUE,
    }),

    getTimetable: builder.query<TimetableGenerationResult, { requiredModuleCodes: string[]; exemptedModuleCodes: string[]; useSpecialTerms?: boolean; maxMcsPerSemester?: number; preserveTimetable?: boolean; preservedData?: Record<number, string[]>; studentContext?: StudentContext | null; clientTimetableName?: string | null }> ({
      query: (args) => ({
        url: '/api/timetable',
        method: 'POST',
        body: {
          required: args.requiredModuleCodes,
          exempted: args.exemptedModuleCodes,
          specialTerms: args.useSpecialTerms,
          maxMcs: args.maxMcsPerSemester,
          preservedTimetable: args.preservedData,
          studentContext: args.studentContext
        }
      }),
    }),
  }),
});

export const { useGetModuleSummariesQuery } = apiSlice;
export const { useGetModuleByCodeQuery, useGetTimetableQuery, useLazyGetTimetableQuery  } = apiSlice;
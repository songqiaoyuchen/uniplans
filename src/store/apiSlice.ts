// we keep ModuleData dynamic for now in case for DB updates
// in the future this should really be static and maintained per semester / acamdeic year
import { ModuleData } from '@/types/plannerTypes';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getModuleByCode } from '@/db/getModuleByCode';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  endpoints: (builder) => ({
    getModuleByCode: builder.query<ModuleData, string>({
      queryFn: async (code) => {
        try {
          const mod = await getModuleByCode(code.toUpperCase());
          if (!mod) {
            return { error: { status: 404, data: { error: `Module ${code} not found` } } };
          }
          return { data: mod };
        } catch (err) {
          return { error: { status: 500, data: { error: 'Failed to fetch module' } } };
        }
      },
      keepUnusedDataFor: Number.MAX_VALUE,
    }),

    getTimetable: builder.query<{ semesters: { id: number; moduleCodes: string[] }[] }, { requiredModuleCodes: string[]; exemptedModuleCodes: string[]; useSpecialTerms?: boolean; maxMcsPerSemester?: number; preserveTimetable?: boolean; preservedData?: Record<number, string[]> }> ({
      query: (args) => ({
        url: '/api/timetable',
        method: 'POST',
        body: {
          required: args.requiredModuleCodes,
          exempted: args.exemptedModuleCodes,
          specialTerms: args.useSpecialTerms,
          maxMcs: args.maxMcsPerSemester,
          preservedTimetable: args.preservedData
        }
      }),
    }),
  }),
});

export const { useGetModuleByCodeQuery, useGetTimetableQuery, useLazyGetTimetableQuery  } = apiSlice;
// src/services/planner/fetchGraph.ts
// Neo4j API for fetching Graph

import axios from "axios";
import type { StudentContext } from "@/types/prerequisiteTypes";

export async function fetchFormattedGraph(moduleCodes: string[]) {
  try {
    const response = await axios.get("/api/formattedGraph", {
      params: { moduleCodes: moduleCodes.join(",") },
    });
    return response.data;
  } catch (error: unknown) {
    console.error(
      `❌ Error fetching merged graph:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}

export async function fetchNormalisedGraph(moduleCodes: string[], studentContext?: StudentContext | null) {
  try {
    const response = await axios.post("/api/normalisedGraph", {
      moduleCodes,
      studentContext,
    });
    return response.data;
  } catch (error: unknown) {
    console.error(
      `❌ Error fetching merged graph:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    throw new Error(axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
      ? error.response.data.error
      : "Unable to load prerequisite graph");
  }
}

export async function fetchFinalGraph(moduleCodes: string[]) {
  try {
    const response = await axios.get("/api/finalGraph", {
      params: { moduleCodes: moduleCodes.join(",") },
    });
    return response.data;
  } catch (error: unknown) {
    console.error(
      `❌ Error fetching merged graph:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}

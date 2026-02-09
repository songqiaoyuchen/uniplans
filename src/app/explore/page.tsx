"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { fetchNormalisedGraph } from "@/services/planner/fetchGraph";
import NormalisedGraphViewer from "./NormalisedGraphViewer";
import { plannerSelectors } from "@/store/plannerSlice";

// MUI Imports
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import Fade from "@mui/material/Fade";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import HubIcon from "@mui/icons-material/Hub"; // Optional: Add an icon for the header

export default function GraphPage() {
  const activeTimetable = useSelector((state: any) =>
    plannerSelectors.selectById(state, state.planner.activeTimetableName)
  );

  const [neo4jData, setNeo4jData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false); // Added generic error tracking for UI

  // Create a stable "signature" of all modules in timetable to auto-refresh
  const moduleSignature = activeTimetable
    ? Object.values(activeTimetable.modules.entities)
      .filter(Boolean)
      .map((m: any) => `${m.code}:${m.status || ""}`)
      .sort()
      .join(",")
    : "";

  useEffect(() => {
    if (!moduleSignature) {
      setNeo4jData(null);
      return;
    }

    const moduleCodes = moduleSignature
      .split(",")
      .map((s) => s.split(":")[0])
      .filter(Boolean);

    const fetchGraph = async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await fetchNormalisedGraph(moduleCodes);
        setNeo4jData(data);
      } catch (err) {
        console.error("❌ Error fetching graph:", err);
        setNeo4jData(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, [moduleSignature]);

  // --- Render Helpers ---

  const renderContent = () => {
    // 1. No Timetable Selected
    if (!activeTimetable) {
      return (
        <Alert severity="warning" variant="outlined">
          No active timetable selected. Please select or create a timetable to view the graph.
        </Alert>
      );
    }

    // 2. No Modules in Timetable
    if (!moduleSignature) {
      return (
        <Alert severity="info" variant="outlined">
          Your timetable is empty. Add modules to visualize their prerequisites and dependencies.
        </Alert>
      );
    }

    // 3. Loading State
    if (loading) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="60vh"
          bgcolor="background.paper"
          borderRadius={2}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={50} thickness={4} />
            <Typography variant="body2" color="text.secondary">
              Calculating dependency graph...
            </Typography>
          </Stack>
        </Box>
      );
    }

    // 4. Error State
    if (error) {
      return (
        <Alert severity="error">
          Failed to load graph data. Please check your connection or try again later.
        </Alert>
      );
    }

    // 5. Success State (The Graph)
    return (
      <Fade in={!!neo4jData} timeout={800}>
        <Paper
          elevation={3}
          sx={{
            height: "75vh", // Fixed height for the viewer
            overflow: "hidden",
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            position: "relative",
          }}
        >
          {neo4jData && <NormalisedGraphViewer graph={neo4jData} />}
        </Paper>
      </Fade>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header Section */}
      <Box mb={3}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <HubIcon color="primary" fontSize="large" />
          <Typography variant="h4" component="h1" fontWeight="bold" color="text.primary">
            Module Dependencies
          </Typography>
        </Stack>
        <Typography variant="subtitle1" color="text.secondary">
          Visualizing prerequisites and relationships for{" "}
          <Box component="span" fontWeight="bold" color="primary.main">
            {activeTimetable ? activeTimetable.name : "..."}
          </Box>
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 3 }} />

      {/* Main Content Area */}
      {renderContent()}
    </Container>
  );
}
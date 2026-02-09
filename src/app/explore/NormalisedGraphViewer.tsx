import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
// @ts-expect-error
import dagre from "cytoscape-dagre";
import type { NormalisedGraph } from "@/types/graphTypes";

// MUI Imports
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

cytoscape.use(dagre);

interface GraphViewerProps {
  graph: NormalisedGraph;
}

export default function GraphViewer({ graph }: GraphViewerProps) {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  useEffect(() => {
    if (!cyRef.current) return;

    if (cyInstance.current) {
      cyInstance.current.destroy();
    }

    const elements: cytoscape.ElementDefinition[] = [];

    // Add nodes
    for (const [id, node] of Object.entries(graph.nodes)) {
      if ("type" in node) {
        elements.push({
          data: {
            id,
            label: `${node.n}OF`,
            type: "logic",
            originalId: id,
          },
        });
      } else {
        elements.push({
          data: {
            id,
            label: node.code,
            type: "module",
            originalId: node.id,
          },
        });
      }
    }

    // Add edges
    for (const edge of graph.edges) {
      elements.push({
        data: {
          id: `edge-${edge.from}->${edge.to}`,
          source: edge.from,
          target: edge.to,
        },
      });
    }

    const cy = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            "font-family": "Roboto, Helvetica, Arial, sans-serif",
            "font-size": "10px", // Reverted to your original size
            "text-wrap": "wrap",
            "text-max-width": "80px",
            color: "#000000", // Black text is best on these pastel colors
            width: 55,       // Reverted to your original dimensions
            height: 55,
          },
        },
        // --- YOUR ORIGINAL COLORS + SHAPE DIFFERENCE ---
        {
          selector: "node[type = 'module']",
          style: {
            "background-color": "#97e685", // Original Green
            shape: "ellipse",
          },
        },
        {
          selector: "node[type = 'logic']",
          style: {
            "background-color": "#F9CB9C", // Original Peach/Orange
            shape: "diamond",              // Distinct shape retained
          },
        },
        // -----------------------------------------------
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#a0a0a0", // Lighter grey to show up on Dark Mode
            "target-arrow-color": "#a0a0a0",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 1.2,
          },
        },
        {
          selector: ":selected",
          style: {
            "border-width": 2,
            "border-color": "#fff",
            "border-style": "solid",
          },
        },
      ],
      layout: {
        name: "dagre",
        nodeSep: 60,
        edgeSep: 40,
        rankSep: 80,
        padding: 40,
        fit: true,
        animate: false, // Animation disabled on load as per original pref
        rankDir: "TB",
      } as any,
    });

    cyInstance.current = cy;
    setStats({ nodes: cy.nodes().length, edges: cy.edges().length });

    // Enable Pan/Zoom interactions
    cy.userPanningEnabled(true);
    cy.userZoomingEnabled(true);
    
    // NOTE: "Click to zoom" listeners have been completely removed.

    return () => {
      if (cyInstance.current) {
        cyInstance.current.destroy();
      }
    };
  }, [graph]);

  // --- Controls Handlers ---
  const handleFit = () => cyInstance.current?.animate({ fit: {
    padding: 40,
    eles: cyInstance.current.elements()
  }, duration: 400 });
  
  const handleZoomIn = () => {
    if (!cyInstance.current) return;
    cyInstance.current.zoom({
      level: cyInstance.current.zoom() * 1.2,
      renderedPosition: { x: cyRef.current!.offsetWidth / 2, y: cyRef.current!.offsetHeight / 2 }
    });
  };
  
  const handleZoomOut = () => {
    if (!cyInstance.current) return;
    cyInstance.current.zoom({
      level: cyInstance.current.zoom() / 1.2,
      renderedPosition: { x: cyRef.current!.offsetWidth / 2, y: cyRef.current!.offsetHeight / 2 }
    });
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        bgcolor: "#121212", // Dark Background
      }}
    >
      <div
        ref={cyRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      {/* Floating Controls (Dark Theme) */}
      <Paper
        elevation={4}
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          borderRadius: 2,
          p: 0.5,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          bgcolor: "#1e1e1e",
          color: "#fff",
          border: "1px solid #333",
        }}
      >
        <Tooltip title="Zoom In" placement="left" arrow>
          <IconButton size="small" onClick={handleZoomIn} sx={{ color: "#fff" }}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom Out" placement="left" arrow>
          <IconButton size="small" onClick={handleZoomOut} sx={{ color: "#fff" }}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Divider flexItem sx={{ bgcolor: "#444" }} />
        <Tooltip title="Reset View" placement="left" arrow>
          <IconButton size="small" onClick={handleFit} sx={{ color: "#90caf9" }}>
            <CenterFocusStrongIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* Stats Overlay (Dark Theme) */}
      <Paper
        elevation={0}
        sx={{
          position: "absolute",
          bottom: 16,
          left: 16,
          zIndex: 10,
          p: 1.5,
          borderRadius: 2,
          bgcolor: "rgba(30, 30, 30, 0.9)",
          backdropFilter: "blur(4px)",
          border: "1px solid #333",
          color: "#fff",
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Stats chips matching the node colors */}
            <Chip
              label={`${stats.nodes} Nodes`}
              size="small"
              sx={{ bgcolor: "#97e685", color: "#000", fontWeight: 600 }}
            />
            <Chip
              label={`${stats.edges} Edges`}
              size="small"
              variant="outlined"
              sx={{ color: "#ccc", borderColor: "#555" }}
            />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <InfoOutlinedIcon fontSize="inherit" sx={{ color: "#aaa", fontSize: 14 }} />
            <Typography variant="caption" sx={{ color: "#aaa" }}>
               Drag canvas to pan • Scroll to zoom
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
"use client";

import { useAppDispatch, useAppSelector } from "@/store";
import { toggleSidebar, setActiveTab } from "@/store/sidebarSlice";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ModuleDetails from "./ModuleDetails";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ModuleSearch from "./ModuleSearch";
import { useModuleState } from "../../hooks";
import { SIDEBAR_WIDTH } from "@/constants";
import { useSearchParams } from "next/navigation";
import CircularProgress from "@mui/material/CircularProgress";
import InfoOutlineIcon from "@mui/icons-material/InfoOutline";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import Generate from "./Generate";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";

// Define tab configuration
const tabs = [
  { icon: <InfoOutlineIcon />, label: "Details" },
  { icon: <EditCalendarIcon />, label: "Generate" },
];

const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const isOpen = useAppSelector((state) => state.sidebar.isOpen);
  const tabValue = useAppSelector((state) => state.sidebar.activeTab);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isLargeScreen = useMediaQuery(theme.breakpoints.up("lg"));

  const sidebarWidth = isLargeScreen ? 336 : SIDEBAR_WIDTH;

  const [drawerHeight, setDrawerHeight] = useState(40); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const startHeight = useRef(0);

  const handleToggle = () => dispatch(toggleSidebar());
  const handleTabChange = (newValue: number) => {
    dispatch(setActiveTab(newValue));
  };

  const handleDragStart = (e: React.TouchEvent) => {
    if (!isOpen) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    startHeight.current = drawerHeight;
  };

  const handleDragMove = (e: React.TouchEvent | TouchEvent) => {
    if (!isDragging) return;
    if ("preventDefault" in e && e.cancelable) {
      e.preventDefault();
    }
    const currentY = e.touches[0].clientY;
    const deltaY = dragStartY.current - currentY;
    const newHeight = startHeight.current + (deltaY / window.innerHeight) * 100;
    const clampedHeight = Math.min(Math.max(newHeight, 20), 95);
    setDrawerHeight(clampedHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Auto-close if dragged below 35% of screen height
    if (drawerHeight < 35) {
      dispatch(toggleSidebar());
      setDrawerHeight(40); // Reset to default height
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("touchmove", handleDragMove as any, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
      return () => {
        window.removeEventListener("touchmove", handleDragMove as any);
        window.removeEventListener("touchend", handleDragEnd);
      };
    }
  }, [isDragging]);

  const selectedModuleCode = searchParams.get("module");
  const { mod, isPlanned, isLoading, isFetching }  = useModuleState(selectedModuleCode);

  return isMobile ? (
    <Box
      sx={{
        position: "fixed",
        bottom: isOpen ? 0 : `calc(-${drawerHeight}vh)`,
        left: 0,
        right: 0,
        height: `${drawerHeight}vh`,
        maxHeight: `${drawerHeight}vh`,
        backgroundColor: "background.default",
        borderTop: "2px solid",
        borderColor: "divider",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: 4,
        overflowY: "auto",
        transition: isDragging ? "none" : "bottom 0.3s, height 0.3s",
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        touchAction: "none",
      }}
      onTouchStart={handleDragStart}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
    >
      {/* Rounded top bar handle */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 24,
          backgroundColor: "background.default",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          cursor: "grab",
          touchAction: "none",
          "&:active": {
            cursor: "grabbing",
          },
        }}
        onTouchStart={handleDragStart}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            backgroundColor: "divider",
            borderRadius: "2px",
            transition: "background-color 0.2s",
          }}
        />
      </Box>

      {/* Grab handle when closed */}
      {!isOpen && (
        <Box
          onClick={handleToggle}
          sx={{
            position: "absolute",
            bottom: -20,
            left: "50%",
            transform: "translateX(-50%)",
            width: 40,
            height: 4,
            backgroundColor: "divider",
            borderRadius: "2px",
            cursor: "pointer",
            transition: "background-color 0.2s",
            "&:hover": {
              backgroundColor: "primary.main",
            },
          }}
          role="button"
          aria-label="Swipe up to open sidebar"
          tabIndex={0}
        />
      )}

      {/* Smooth Animated Tabs - Pill Style */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          padding: "12px 16px",
          backgroundColor: "transparent",
          paddingBottom: 0
        }}
      >
        {tabs.map((tab, index) => (
          <Box
            key={index}
            onClick={() => handleTabChange(index)}
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              padding: "12px 16px",
              cursor: "pointer",
              position: "relative",
              color: tabValue === index ? "primary.contrastText" : "text.secondary",
              transition: "color 0.2s",
              zIndex: 1,
              minHeight: "48px",
              borderRadius: "8px",
              userSelect: "none",
            }}
            role="button"
            tabIndex={0}
            aria-pressed={tabValue === index}
            aria-label={`${tab.label} tab`}
          >
            {tabValue === index && (
              <motion.div
                layoutId="mobile-tab-indicator"
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: theme.palette.primary.main,
                  borderRadius: "8px",
                  zIndex: -1,
                }}
                transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {tab.icon}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ p: 2, gap: 2, display: "flex", flexDirection: "column" }}>
        {tabValue === 0 && (
          <>
            {isOpen && <ModuleSearch />}
            {isOpen && (isLoading || isFetching) && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240, width: '100%' }}>
                <CircularProgress />
              </Box>
            )}
            {mod && isOpen && !(isLoading || isFetching) && <ModuleDetails module={mod} isPlanned={isPlanned} />}
          </>
        )}
        {tabValue === 1 && (
          <Generate />
        )}
      </Box>
    </Box>
  ) : (
    <Box
      sx={{
        position: "fixed",
        top: "64px",
        bottom: 0,
        left: 0,
        width: sidebarWidth,
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        backgroundColor: "background.default",
        borderRight: "solid 1px",
        borderColor: "divider",
        transform: isOpen
          ? "translateX(0)"
          : `translateX(-${sidebarWidth - 38}px)`,
        transition: "transform 0.3s, width 0.3s",
      }}
    >
      <IconButton
        onClick={handleToggle}
        size="small"
        sx={{
          position: "absolute",
          top: 18,
          right: -18,
          zIndex: 1500,
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          "&:hover": {
            borderColor: "primary.main",
          },
        }}
      >
        {isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>

      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "flex-start",
          width: "100%",
          overflowY: "auto",
          scrollbarColor: "transparent transparent",
          "&:hover": {
            scrollbarColor: "rgba(62, 62, 62, 1) transparent",
          },
        }}
      >
        {isOpen && (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              padding: "16px 30px 16px 30px",
              width: "100%",
            }}
          >
            {tabs.map((tab, index) => (
              <Box
                key={index}
                onClick={() => handleTabChange(index)}
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  padding: "8px 16px",
                  cursor: "pointer",
                  position: "relative",
                  color: tabValue === index ? "primary.contrastText" : "text.secondary",
                  borderRadius: "8px",
                  transition: "color 0.2s",
                  zIndex: 1,
                }}
              >
                {tabValue === index && (
                  <motion.div
                    layoutId="desktop-tab-indicator"
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: theme.palette.primary.main,
                      borderRadius: "8px",
                      zIndex: -1,
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  {tab.icon}
                </Box>
              </Box>
            ))}
          </Box>
        )}
        
        <Box sx={{ p: isOpen ? "0 30px 30px 30px" : 0, gap: 2, width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
          {tabValue === 0 && (
            <>
              {isOpen && <ModuleSearch />}
              {isOpen && (isLoading || isFetching) && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240, width: '100%' }}>
                  <CircularProgress />
                </Box>
              )}
              {mod && isOpen && selectedModuleCode && !(isLoading || isFetching) && <ModuleDetails module={mod} isPlanned={isPlanned} />}
            </>
          )}
          {tabValue === 1 && isOpen && (
            <Generate />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Sidebar;
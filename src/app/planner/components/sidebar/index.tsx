"use client";

import { useAppDispatch, useAppSelector } from "@/store";
import { closeSidebar, toggleSidebar, setActiveTab } from "@/store/sidebarSlice";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ModuleDetails from "./ModuleDetails";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ModuleSearch from "./ModuleSearch";
import { useModuleState } from "../../hooks";
import { SIDEBAR_WIDTH } from "@/constants";
import { useSearchParams } from "next/navigation";
import CircularProgress from "@mui/material/CircularProgress";
import InfoOutlineIcon from "@mui/icons-material/InfoOutline";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import Generate from "./Generate";
import { motion } from "framer-motion";

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

  const handleToggle = () => dispatch(toggleSidebar());
  const handleTabChange = (newValue: number) => {
    dispatch(setActiveTab(newValue));
  };

  const selectedModuleCode = searchParams.get("module");
  const { mod, isPlanned, isLoading, isFetching }  = useModuleState(selectedModuleCode);

  return isMobile ? (
    <Drawer
      elevation={0}
      anchor="left"
      open={isOpen}
      onClose={() => dispatch(closeSidebar())}
      transitionDuration={{ enter: 225, exit: 180 }}
      ModalProps={{ keepMounted: true, disableScrollLock: false }}
      slotProps={{
        backdrop: { sx: { top: "64px" } },
        paper: {
          sx: {
            top: "64px",
            bottom: "auto",
            width: "100vw",
            height: "calc(100dvh - 64px)",
            boxSizing: "border-box",
            overflow: "hidden",
            backgroundColor: "background.default",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        },
      }}
      sx={{ top: "64px" }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          data-dnd-no-autoscroll
          sx={{
            p: 2,
            gap: 2,
            display: "flex",
            flex: 1,
            minHeight: 0,
            flexDirection: "column",
            overflowY: "auto",
            overscrollBehavior: "contain",
          }}
        >
          {/* Smooth Animated Tabs - Pill Style */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              backgroundColor: "transparent",
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
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  {tab.icon}
                </Box>
              </Box>
            ))}
            <IconButton
              onClick={() => dispatch(closeSidebar())}
              aria-label="Close sidebar"
              size="small"
              sx={{ color: "text.secondary", flexShrink: 0 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {tabValue === 0 && (
            <>
              <ModuleSearch />
              {(isLoading || isFetching) && (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 240, width: "100%" }}>
                  <CircularProgress />
                </Box>
              )}
              {mod && !(isLoading || isFetching) && (
                <ModuleDetails module={mod} isPlanned={isPlanned} />
              )}
            </>
          )}
          {tabValue === 1 && <Generate />}
        </Box>
      </Box>
    </Drawer>
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
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Navlink from "../ui/Navlink";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import CloseIcon from "@mui/icons-material/Close";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useThemeMode } from "@/providers/ThemeProvider";

const pages = [
  { name: "Home", href: "/", icon: <HomeOutlinedIcon /> },
  {
    name: "Planner",
    href: "/planner",
    icon: <CalendarMonthOutlinedIcon />,
  },
  { name: "Explore", href: "/explore", icon: <ExploreOutlinedIcon /> },
];

const settings = ["Profile", "Account", "Logout"];

function Navbar() {
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const router = useRouter();
  const { mode } = useThemeMode();

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  return (
    <AppBar position="fixed" elevation={0} sx={{ height: "64px" }}>
      <Toolbar
        disableGutters
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mx: { xs: 2, md: 4 },
          height: "64px",
        }}
      >
        {/* Left side */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {/* Laptop title */}
          <Typography
            variant="h6"
            component="a"
            href="/"
            noWrap
            sx={{
              mr: 2,
              display: { xs: "none", md: "flex" },
              fontFamily: "monospace",
              fontWeight: 700,
              fontSize: "1.5rem",
              letterSpacing: ".3rem",
              color: mode == "light" ? "secondary.main" : "primary.light",
              textDecoration: "none",
              userSelect: "none",
              cursor: "pointer",
              "&:hover": {
                color:
                  mode == "light" ? "secondary.light" : "primary.extraLight",
              },
            }}
          >
            UNIPLANS
          </Typography>

          {/* Laptop Navlinks */}
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}>
            {pages.map((page) => (
              <Navlink key={page.name} href={page.href}>
                {page.name}
              </Navlink>
            ))}
          </Box>

          {/* Mobile navigation */}
          <Box
            sx={{
              position: "relative",
              display: { xs: "flex", md: "none" },
            }}
          >
            <IconButton
              size="large"
              onClick={() => setMobileNavOpen((open) => !open)}
              color="inherit"
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileNavOpen}
              aria-controls="Mobilenavigation-actions"
              sx={{
                borderRadius: 1.5,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              {mobileNavOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>

            <SpeedDial
              ariaLabel="Mobile navigation"
              direction="down"
              open={mobileNavOpen}
              onClose={() => setMobileNavOpen(false)}
              FabProps={{
                "aria-hidden": true,
                tabIndex: -1,
                sx: { display: "none" },
              }}
              sx={{
                position: "absolute",
                top: "60px",
                left: -4,
                "& .MuiSpeedDial-actions": {
                  mt: "0 !important",
                  pt: 0,
                },
              }}
            >
              {pages.map((page) => (
                <SpeedDialAction
                  key={page.name}
                  icon={page.icon}
                  tooltipTitle={page.name}
                  tooltipOpen={mobileNavOpen}
                  tooltipPlacement="right"
                  onClick={() => {
                    setMobileNavOpen(false);
                    router.push(page.href);
                  }}
                />
              ))}
            </SpeedDial>
          </Box>
        </Box>

        {/* Mobile Title (Centered) */}
        <Box
          sx={{
            display: { xs: "flex", md: "none" },
            justifyContent: "center",
            flexGrow: 1,
          }}
        >
          <Typography
            variant="h5"
            noWrap
            component="a"
            href="/"
            sx={{
              fontFamily: "monospace",
              fontWeight: 700,
              fontSize: "1.5rem",
              letterSpacing: ".3rem",
              color: mode == "light" ? "secondary.main" : "primary.light",
              textDecoration: "none",
              userSelect: "none",
              cursor: "pointer",
              "&:hover": {
                color:
                  mode == "light" ? "secondary.light" : "primary.extraLight",
              },
            }}
          >
            UNIPLANS
          </Typography>
        </Box>

        {/* Right Side Icons */}
        <Box
          sx={{ flexGrow: 0, display: "flex", alignItems: "center", gap: 1 }}
        >
          {/* Theme Toggle for Desktop */}
          <ThemeToggle />
          {/* <Tooltip title="Open Profile Menu" arrow>
            <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
              <Avatar alt="Remy Sharp" src="user.png" />
            </IconButton>
          </Tooltip> */}
          <Menu
            sx={{ mt: "45px" }}
            id="menu-appbar"
            anchorEl={anchorElUser}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
          >
            {settings.map((setting) => (
              <MenuItem key={setting} onClick={handleCloseUserMenu}>
                <Typography sx={{ textAlign: "center" }}>{setting}</Typography>
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;

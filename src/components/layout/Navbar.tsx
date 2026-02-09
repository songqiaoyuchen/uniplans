"use client";

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Navlink from "../ui/Navlink";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useThemeMode } from "@/providers/ThemeProvider";

const pages = [
  { name: "Home", href: "/" },
  { name: "Planner", href: "/planner" },
  { name: "Explore", href: "/explore" },
];

const settings = ["Profile", "Account", "Logout"];

function Navbar() {
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { mode } = useThemeMode();

  const toggleMobileNav = (open: boolean) => () => {
    setMobileNavOpen(open);
  };

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

          {/* Mobile Menu Icon */}
          <IconButton
            size="large"
            onClick={toggleMobileNav(true)}
            color="inherit"
            sx={{ 
              display: { xs: "flex", md: "none" },
              borderRadius: 1.5,
              "&:hover": { bgcolor: "action.hover" }
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Mobile Drawer */}
          <SwipeableDrawer
            anchor="bottom"
            open={mobileNavOpen}
            onOpen={toggleMobileNav(true)}
            onClose={toggleMobileNav(false)}
            disableSwipeToOpen={true}
            slotProps={{
              paper: {
                sx: {
                  borderTopLeftRadius: "8px",
                  borderTopRightRadius: "8px",
                  boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.2)",
                },
              },
            }}
          >
            <Box
              sx={{ width: "100%" }}
              role="presentation"
              onClick={toggleMobileNav(false)}
            >
              <List>
                {pages.map((page) => (
                  <ListItem key={page.name} disablePadding>
                    <ListItemButton component="a" href={page.href}>
                      <ListItemText primary={page.name} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </SwipeableDrawer>
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

"use client";

import { Box, Typography, Button, Container, Stack } from "@mui/material";

import Grid from "@mui/material/Grid";

// import Link from "next/link"; // Uncomment for Next.js SPA navigation
import { motion } from "framer-motion";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FlagIcon from '@mui/icons-material/Flag';

// --- ASSETS ---
// Make sure these files exist in your public/assets/ folder
const VID_SEARCHBAR = "/assets/searchbar.mp4"; 
const VID_TARGET = "/assets/target.mp4";
const VID_GENERATE = "/assets/generate.mp4";
const VID_CUSTOMIZE = "/assets/customize.mp4";

export default function Home() {
  return (
    <Box sx={{ 
      // MATCHED TO THEME DEFAULT BACKGROUND
      bgcolor: "#1f1f1f", 
      minHeight: "100vh", 
      color: "#e4e4e7", 
      overflowX: "hidden", 
      position: "relative",
    }}>
      
      <Box sx={{ position: "relative", zIndex: 1, px: { xs: 2, md: 4 } }}>

        {/* --- HERO SECTION --- */}
        <Box sx={{ height: "90vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <Container maxWidth="md">
            <ScrollReveal>
              <Box sx={{ mb: 3, display: "inline-block", px: 2, py: 0.5, borderRadius: "20px", border: "1px solid rgba(255,255,255,0.1)", bgcolor: "rgba(255,255,255,0.03)" }}>
                <Typography variant="subtitle2" sx={{ color: "#a1a1aa", letterSpacing: "0.1em", fontWeight: 600 }}>
                  ACADEMIC PLANNING SIMPLIFIED
                </Typography>
              </Box>
              <Typography variant="h1" sx={{ fontWeight: 800, mb: 3, letterSpacing: "-0.03em", lineHeight: 1.1, color: "white" }}>
                Start at the <span style={{ color: "#a78bfa" }}>Finish Line.</span>
              </Typography>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <Typography variant="h5" sx={{ color: "#a1a1aa", mb: 5, lineHeight: 1.6, maxWidth: "700px", mx: "auto", fontWeight: 400 }}>
                Most planners make you build Year 1 first. We don&apos;t.<br />
                Tell us the degree you want in Year 4, and we auto-generate the complete path to get you there.
              </Typography>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
                <Button 
                  // component={Link} 
                  href="/planner" 
                  variant="contained" size="large" 
                  sx={{ 
                    px: 5, py: 1.5, fontSize: "1rem", borderRadius: "8px", 
                    bgcolor: "#fff", color: "#000", fontWeight: 600,
                    "&:hover": { bgcolor: "#f4f4f5" } 
                  }}
                >
                  Start Planning
                </Button>
                <Button 
                  component="a" href="#how-it-works" 
                  variant="outlined" size="large" 
                  sx={{ 
                    px: 5, py: 1.5, fontSize: "1rem", borderRadius: "8px", 
                    borderColor: "#52525b", color: "#fff", 
                    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.05)" } 
                  }}
                >
                  How it Works
                </Button>
              </Stack>
            </ScrollReveal>
          </Container>
        </Box>

        {/* --- STATS BAR --- */}
        <Box sx={{ borderY: "1px solid #333", bgcolor: "#1f1f1f", py: 8 }}>
          <Container maxWidth="lg">
            <Grid container spacing={4} textAlign="center">
              <StatItem 
                icon={<FlagIcon sx={{ fontSize: 30, color: "#a78bfa", mb: 2 }} />} 
                number="Step 1" label="Set Goals" 
              />
              <StatItem 
                icon={<AccountTreeIcon sx={{ fontSize: 30, color: "#34d399", mb: 2 }} />} 
                number="Step 2" label="Auto-Fill Path" 
              />
              <StatItem 
                icon={<EditCalendarIcon sx={{ fontSize: 30, color: "#f472b6", mb: 2 }} />} 
                number="Step 3" label="Customize" 
              />
            </Grid>
          </Container>
        </Box>

        {/* --- WORKFLOW GUIDE --- */}
        <Container id="how-it-works" maxWidth="lg" sx={{ py: 15 }}>
          
          {/* STEP 1: INPUT */}
          <Grid container spacing={8} alignItems="center" sx={{ mb: 15 }}>
            {/* @ts-ignore */}
            <Grid item xs={12} md={5}>
              <ScrollReveal>
                <StepLabel num="01" title="The Setup" color="#a78bfa" />
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, color: "white" }}>Select Your Targets</Typography>
                <Typography variant="body1" sx={{ color: "#a1a1aa", fontSize: "1.05rem", lineHeight: 1.7, mb: 3 }}>
                  Instead of guessing prerequisites, just tell us what you want to achieve. Search for your <strong>Degree Core Modules</strong> or specific <strong>Capstone Projects</strong> and add them to your plan.
                </Typography>
                <InstructionPoint text="Search by module code or name" />
                <InstructionPoint text="Flag any target modules you want to explore" />
                <InstructionPoint text="Or exempt them if you want to skip them" />
              </ScrollReveal>
            </Grid>
          </Grid>
          <Grid container spacing={12} justifyContent="center" alignItems="center" sx={{ mb: 15 }}>
            <ScrollReveal direction="right">
              <Grid
                container
                spacing={16}
                justifyContent="center"
                alignItems="center"
              >
                {/* @ts-ignore */}
                <Grid item xs={12} md={6}>
                  <AppWindowVideo src={VID_SEARCHBAR} glowColor="#a78bfa" />
                </Grid>
                {/* @ts-ignore */}
                <Grid item xs={12} md={6}>
                  <AppWindowVideo src={VID_TARGET} glowColor="#a78bfa" />
                </Grid>
              </Grid>
            </ScrollReveal>
          </Grid>
          

          {/* STEP 2: GENERATION */}
          <Grid container spacing={8} alignItems="center" sx={{ mb: 15, flexDirection: { xs: "column-reverse", md: "row" } }}>
            {/* @ts-ignore */}
            <Grid item xs={12} md={5}>
              <ScrollReveal>
                <StepLabel num="02" title="The Automation" color="#34d399" />
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, color: "white" }}>We Fill the Gaps</Typography>
                <Typography variant="body1" sx={{ color: "#a1a1aa", fontSize: "1.05rem", lineHeight: 1.7, mb: 3 }}>
                  Once your targets are set, our system analyzes the entire university catalog. It automatically identifies and schedules every prerequisite you need to reach your goals, starting from Year 1.
                </Typography>
                <InstructionPoint text="Visualizes your dependency tree" />
                <InstructionPoint text="Creates a complete academic timeline" />
              </ScrollReveal>
            </Grid>
          </Grid>
          <Grid container spacing={12} justifyContent="center" alignItems="center" sx={{ mb: 15 }}>
            <ScrollReveal direction="right">
              <Grid
                container
                spacing={16}
                justifyContent="center"
                alignItems="center"
              >
                {/* @ts-ignore */}
                <Grid item xs={12} md={6}>
                  <AppWindowVideo src={VID_GENERATE} glowColor="#34d399" />
                </Grid>
              </Grid>
            </ScrollReveal>
          </Grid>

          {/* STEP 3: CUSTOMIZATION */}
          <Grid container spacing={8} alignItems="center">
            {/* @ts-ignore */}
            <Grid item xs={12} md={5}>
              <ScrollReveal>
                <StepLabel num="03" title="The Refinement" color="#f472b6" />
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, color: "white" }}>Make it Yours</Typography>
                <Typography variant="body1" sx={{ color: "#a1a1aa", fontSize: "1.05rem", lineHeight: 1.7, mb: 3 }}>
                  The auto-generated plan is just a starting point. Drag cards to different semesters to balance your workload. We act as your safety net—flagging any issues if you break a rule or pick a module that isn&apos;t offered.
                </Typography>
                <InstructionPoint text="Drag-and-drop customization" />
                <InstructionPoint text="Instant error checking & validation" />
              </ScrollReveal>
            </Grid>
          </Grid>
          <Grid container spacing={12} justifyContent="center" alignItems="center" sx={{ my: 15 }}>
            <ScrollReveal direction="right">
              <Grid
                container
                spacing={16}
                justifyContent="center"
                alignItems="center"
              >
                {/* @ts-ignore */}
                <Grid item xs={12} md={6}>
                  <AppWindowVideo src={VID_CUSTOMIZE} glowColor="#f472b6" />
                </Grid>
              </Grid>
            </ScrollReveal>
          </Grid>

        </Container>

        {/* --- FOOTER CTA --- */}
        <Box sx={{ py: 12, textAlign: "center", borderTop: "1px solid #333" }}>
          <ScrollReveal>
            <Typography variant="h3" fontWeight="bold" sx={{ mb: 2, color: "white" }}>Ready to design your path?</Typography>
            <Typography variant="h6" sx={{ color: "#71717a", mb: 5 }}>Stop using spreadsheets. Start using logic.</Typography>
            <Button 
              // component={Link} 
              href="/planner" 
              variant="contained" size="large" endIcon={<ArrowForwardIcon />}
              sx={{ 
                px: 6, py: 2, fontSize: "1.1rem", borderRadius: "8px", 
                bgcolor: "#fff", color: "#000", fontWeight: 600,
                "&:hover": { bgcolor: "#f4f4f5" } 
              }}
            >
              Start Planning
            </Button>
          </ScrollReveal>
        </Box>
      </Box>
    </Box>
  );
}

// ================= SUB-COMPONENTS =================

function StepLabel({ num, title, color = "#a78bfa" }: { num: string, title: string, color?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ color: color, fontWeight: 700 }}>{num}</Typography>
      <Box sx={{ width: '40px', height: '1px', bgcolor: '#3f3f46' }} />
      <Typography variant="subtitle2" sx={{ color: "#71717a", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</Typography>
    </Box>
  )
}

function StatItem({ icon, number, label }: { icon: React.ReactNode, number: string, label: string }) {
  return (
    // @ts-expect-error
    <Grid item xs={12} md={4}>
      {icon}
      <Typography variant="h5" sx={{ fontWeight: 700, color: "white", mb: 0.5 }}>{number}</Typography>
      <Typography variant="body2" sx={{ color: "#a1a1aa", fontWeight: 500 }}>{label}</Typography>
    </Grid>
  );
}

// NEW: App Window Style Video Component
// - Adds a "Browser" top bar
// - Removes padding/border for a seamless look
// - Adds a colored glow behind the window
import React, { useRef, useEffect, useState } from "react";

function AppWindowVideo({ src, poster, glowColor = "#a78bfa" }: { src: string, poster?: string, glowColor?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    let observer: IntersectionObserver | null = null;
    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer && observer.disconnect();
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(node);
    } else {
      // Fallback: always load if no IntersectionObserver
      setIsVisible(true);
    }
    return () => {
      observer && observer.disconnect();
    };
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      {/* Smooth Ambient Glow */}
      <Box 
        sx={{
          position: "absolute",
          top: 40,
          left: 40,
          right: 40,
          bottom: 40,
          bgcolor: glowColor,
          filter: "blur(80px)",
          opacity: 0.35,
          zIndex: 0,
          pointerEvents: "none",
        }} 
      />

      {/* Main Window Content */}
      <Box sx={{ 
        position: 'relative',
        zIndex: 1,
        borderRadius: 3, 
        bgcolor: "#1e1e1e",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        overflow: "hidden" 
      }}>
        {/* Browser Window Controls (Traffic Lights) */}
        <Box sx={{ 
          px: 2, py: 1.5, 
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", gap: 1
        }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff5f56', opacity: 0.8 }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ffbd2e', opacity: 0.8 }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#27c93f', opacity: 0.8 }} />
        </Box>

        {/* Edge-to-Edge Video */}
        <Box 
          component="video"
          ref={videoRef}
          poster={poster}
          autoPlay 
          loop 
          muted 
          playsInline 
          sx={{ 
            width: "100%", 
            height: "auto",
            display: "block",
            objectFit: "cover",
          }}
          {...(isVisible ? { src } : {})}
        />
      </Box>
    </Box>
  );
}

interface ScrollRevealProps { children: React.ReactNode; delay?: number; direction?: "up" | "left" | "right"; }
function ScrollReveal({ children, delay = 0, direction = "up" }: ScrollRevealProps) {
  const variants = {
    hidden: { opacity: 0, y: direction === "up" ? 30 : 0, x: direction === "left" ? -30 : direction === "right" ? 30 : 0 },
    visible: { opacity: 1, y: 0, x: 0 }
  };
  return (
    <motion.div
      style={{ display:"contents" }} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }} variants={variants}
    >
      {children}
    </motion.div>
  );
}

function InstructionPoint({ text }: { text: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
      <CheckCircleIcon sx={{ color: "#52525b", fontSize: 20 }} />
      <Typography variant="body1" sx={{ color: "#d4d4d8", fontWeight: 400 }}>{text}</Typography>
    </Stack>
  );
}
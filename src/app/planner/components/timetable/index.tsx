import Box from "@mui/material/Box";
import TimetableSemester from "./TimeTableSemester";
import TimetableHeader from "./TimetableHeader";
import Button from "@mui/material/Button";
import { useAppSelector, useAppDispatch } from "@/store";
import { selectIsMinimalView, selectSemesterIds } from "@/store/timetableSelectors";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "@/constants";
import { semesterAdded } from "@/store/timetableSlice"; // Update path if different
import { memo } from "react";
import { RootState } from "@/store";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

function Timetable() {
  const semesterIds = useAppSelector(selectSemesterIds) as number[];
  const isOpen = useAppSelector((state: RootState) => state.sidebar.isOpen);
  const isMinimalView = useAppSelector(selectIsMinimalView);
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up("lg"));
  
  const responsiveSidebarWidth = isLargeScreen ? 336 : SIDEBAR_WIDTH;
  const sidebarWidth = isOpen ? responsiveSidebarWidth : SIDEBAR_COLLAPSED_WIDTH;
  const dispatch = useAppDispatch();

  const handleAddSpecialTerm = (id: number) => {
    dispatch(semesterAdded({ id }));
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        p: 0,
        my: 2,
        marginRight: { xs: 2, md: 4 },
        marginLeft: { xs: 2, md: `${sidebarWidth + 32}px` },
        transition: "margin-left 0.3s",
        flex: 1,
        minWidth: 0,
      }}
    >
      <TimetableHeader />

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          overflowX: "auto",
          overflowY: "hidden",
          py: 1,
          gap: 1,
          borderRadius: 1,
          flex: 1,
          height: "100%",
        }}
      >
        {/* Semesters */}
        {semesterIds
          .filter((id) => id % 2 === 0) // main terms
          .map((mainId) => {
            const hasSpecialTerm = semesterIds.includes(mainId + 1);

            return (
              <Box
                key={mainId}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  flex: 1,
                  height: "100%",
                  justifyContent: isMinimalView ? "space-between" : "flex-start",
                  maxWidth: isMinimalView ? '100%' : '245px',   // cap width in normal view
                }}
              >
                {/* Main semesters */}
                <Box sx={{ flex: isMinimalView ? 1 : 'unset', minHeight: 0 }}>
                  <TimetableSemester semesterId={mainId} />
                </Box>

                {/* Special term */}
                <Box>
                  {hasSpecialTerm ? (
                    <TimetableSemester semesterId={mainId + 1} />
                  ) : (
                    <Button
                      variant="outlined"
                      onClick={() => handleAddSpecialTerm(mainId + 1)}
                      sx={{ 
                        borderRadius: 1,
                        width: '100%',
                        fontWeight: isMinimalView ? 500 : 600,
                        py: isMinimalView ? 0.5 : 1,
                      }}
                    >
                      + Special Term
                    </Button>
                  )}
                </Box>
              </Box>);
          })}
        {/* Add Semester */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            flex: 1,
            height: "100%",
            justifyContent: isMinimalView ? "space-between" : "flex-start",
          }}
        >
          <Button
            variant="outlined"
            onClick={() => {
              const evenIds = semesterIds.filter((id) => id % 2 === 0);
              const nextMainId = evenIds.length ? Math.max(...evenIds) + 2 : 0;
              dispatch(semesterAdded({ id: nextMainId }));
            }}
            sx={{
              borderRadius: 1,
              width: '100%',
              minWidth: isMinimalView ? 'unset' : '245px',
              fontWeight: isMinimalView ? 500 : 600,
              py: isMinimalView ? 0.5 : 1,
            }}
          >
            + Semester
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default memo(Timetable);

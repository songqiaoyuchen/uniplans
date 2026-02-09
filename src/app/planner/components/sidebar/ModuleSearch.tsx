"use client";

import { useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import moduleData from "@/data/miniModuleData.json";
import { MiniModuleData } from "@/types/plannerTypes";
import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import { useAppDispatch } from "@/store";
import { useRouter } from "next/navigation";
import { moduleSelected } from "@/store/timetableSlice";

const ModuleSearch = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [value, setValue] = useState<MiniModuleData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); // for blurring

  const fuse = useMemo(() => {
    return new Fuse<MiniModuleData>(moduleData, {
      keys: ["code", "title"],
      threshold: 0.3,
    });
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse
      .search(query)
      .map((r) => r.item)
      .slice(0, 15);
  }, [fuse, query]);

  const handleSearch = async (_: any, mod: MiniModuleData | null) => {
    if (!mod) return;

    setQuery("");
    setValue(null);

    dispatch(moduleSelected(mod.code));

    // naviagte
    router.push(`?module=${mod.code}`, { scroll: false });

    // blur search box
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };


  return (
    <Autocomplete
      sx={{ width: "100%" }}
      autoHighlight
      open={Boolean(query.trim())}
      options={results}
      noOptionsText="No matching modules"
      getOptionLabel={(mod) => `${mod.code} ${mod.title}`}
      inputValue={query}
      value={value}
      onInputChange={(_, val) => setQuery(val)}
      onChange={handleSearch}
      popupIcon={null}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder="Search for modules..."
          variant="outlined"
          inputRef={inputRef}
          sx={{
            width: "100%",
            "& .MuiOutlinedInput-root": {
              borderRadius: "9999px",
              "& fieldset": {
                borderColor: "primary.main",
              },
              "&:hover fieldset": {
                borderColor: "primary.light",
              },
              "&.Mui-focused fieldset": {
                borderColor: "primary.main",
                borderWidth: 2,
              },
            },
          }}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    sx={{
                      backgroundColor: "primary.main",
                      borderRadius: "50%",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <SearchIcon sx={{ color: "white", fontSize: 20 }} />
                  </Box>
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      disablePortal
      clearOnBlur={true}
    />
  );
};

export default ModuleSearch;

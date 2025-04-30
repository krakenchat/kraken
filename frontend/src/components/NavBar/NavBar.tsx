import * as React from "react";
import Drawer from "@mui/material/Drawer";
import { Toolbar } from "@mui/material";

const NavBar = () => {
  return (
    <Drawer
      sx={{
        display: "flex",
      }}
      variant="permanent"
      anchor="left"
    >
      <Toolbar>Permanent</Toolbar>
    </Drawer>
  );
};

export default NavBar;

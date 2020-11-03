import React from "react";

import Navbar from "./navbar";
import LoadableDoodle from "../components/loadabledoodle";

import "../styles/index.scss";
import scrollableLayoutStyles from "./scrollablelayout.module.scss";

export default function ScrollableLayout(props) {
  return (
    <div className={scrollableLayoutStyles.container}>
      <LoadableDoodle/>
      <div className={scrollableLayoutStyles.content}>
        {props.children}
      </div>
      <Navbar />
    </div>
  );
}

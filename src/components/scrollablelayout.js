import React from "react";

import Navbar from "./navbar";
import Doodle from "../components/doodle"

import "../styles/index.scss";
import scrollableLayoutStyles from "./scrollablelayout.module.scss";

export default function ScrollableLayout(props) {
  return (
    <div className={scrollableLayoutStyles.container}>
      <Doodle/>
      <div className={scrollableLayoutStyles.content}>
        {props.children}
      </div>
      <Navbar />
    </div>
  );
}

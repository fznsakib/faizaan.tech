import React from "react";
import Navbar from "./navbar";

import "../styles/index.scss";
import scrollableLayoutStyles from "./scrollablelayout.module.scss";

export default function ScrollableLayout(props) {
  return (
    <div>
      <div className={scrollableLayoutStyles.container}>
        <div className={scrollableLayoutStyles.content}>{props.children}</div>
        <Navbar />
      </div>
    </div>
  );
}

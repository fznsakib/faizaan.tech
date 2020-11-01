import React from "react";

import Navbar from "./navbar";
import Doodle from "../components/doodle"

import "../styles/index.scss";
import layoutStyles from "./layout.module.scss";

export default function Layout(props) {
  return (
    <div className={layoutStyles.container}>
      <Doodle className={layoutStyles.doodle}/>
      <div className={layoutStyles.content}>
        {props.children}
      </div>
      <Navbar />
    </div>
  );
}

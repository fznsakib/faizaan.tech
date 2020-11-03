import React from "react";

import Navbar from "./navbar";
import LoadableDoodle from "../components/loadabledoodle";

import "../styles/index.scss";
import layoutStyles from "./layout.module.scss";

export default function Layout(props) {
  return (
    <div className={layoutStyles.container}>
      <LoadableDoodle/>
      <div className={layoutStyles.content}>
        {props.children}
      </div>
      <Navbar />
    </div>
  );
}

import React from "react";

import projectGridBoxStyles from "./projectgridbox.module.scss";

export default function ProjectGridBox(props) {
  return <div className={projectGridBoxStyles.box}>{props.name}</div>;
}
